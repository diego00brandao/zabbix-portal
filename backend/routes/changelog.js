const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { db } = require('../db/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '../uploads/changelog');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random()*1e6);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// ========== PROJECTS ==========
router.get('/projects', authMiddleware, (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT p.*, COUNT(e.id) as entry_count
      FROM changelog_projects p
      LEFT JOIN changelog_entries e ON e.project_id = p.id
      GROUP BY p.id ORDER BY p.created_at DESC
    `).all();
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/projects', authMiddleware, (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
  try {
    const r = db.prepare('INSERT INTO changelog_projects (name, description, created_by, created_at) VALUES (?,?,?,?)').run(name, description||'', req.user.username, new Date().toISOString());
    res.status(201).json({ id: r.lastInsertRowid });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/projects/:id', authMiddleware, (req, res) => {
  const { name, description } = req.body;
  try {
    db.prepare('UPDATE changelog_projects SET name=?,description=? WHERE id=?').run(name, description||'', req.params.id);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/projects/:id', authMiddleware, (req, res) => {
  try {
    // Delete attachments files
    const entries = db.prepare('SELECT id FROM changelog_entries WHERE project_id=?').all(req.params.id);
    for (const e of entries) {
      const atts = db.prepare('SELECT filepath FROM changelog_attachments WHERE entry_id=?').all(e.id);
      for (const a of atts) { try { fs.unlinkSync(a.filepath); } catch {} }
      db.prepare('DELETE FROM changelog_attachments WHERE entry_id=?').run(e.id);
    }
    db.prepare('DELETE FROM changelog_entries WHERE project_id=?').run(req.params.id);
    db.prepare('DELETE FROM changelog_projects WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ========== ENTRIES ==========
router.get('/projects/:projectId/entries', authMiddleware, (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM changelog_entries WHERE project_id=? ORDER BY created_at DESC').all(req.params.projectId);
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/projects/:projectId/entries', authMiddleware, (req, res) => {
  const { title, description, related_resource, resource_type, ticket, status, progress } = req.body;
  if (!title) return res.status(400).json({ error: 'Título é obrigatório' });
  try {
    const r = db.prepare('INSERT INTO changelog_entries (project_id, title, description, related_resource, resource_type, ticket, status, progress, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run(req.params.projectId, title, description||'', related_resource||'', resource_type||'host', ticket||'', status||'To Do', progress||0, req.user.username, new Date().toISOString());
    res.status(201).json({ id: r.lastInsertRowid });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/entries/:id', authMiddleware, (req, res) => {
  const { title, description, related_resource, resource_type, ticket, status, progress } = req.body;
  try {
    db.prepare('UPDATE changelog_entries SET title=?,description=?,related_resource=?,resource_type=?,ticket=?,status=?,progress=?,updated_at=? WHERE id=?').run(title, description||'', related_resource||'', resource_type||'host', ticket||'', status||'To Do', progress||0, new Date().toISOString(), req.params.id);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/entries/:id', authMiddleware, (req, res) => {
  try {
    const atts = db.prepare('SELECT filepath FROM changelog_attachments WHERE entry_id=?').all(req.params.id);
    for (const a of atts) { try { fs.unlinkSync(a.filepath); } catch {} }
    db.prepare('DELETE FROM changelog_attachments WHERE entry_id=?').run(req.params.id);
    db.prepare('DELETE FROM changelog_entries WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ========== ATTACHMENTS ==========
router.get('/entries/:entryId/attachments', authMiddleware, (req, res) => {
  try {
    res.json(db.prepare('SELECT id, filename, size, mimetype, created_at FROM changelog_attachments WHERE entry_id=? ORDER BY created_at DESC').all(req.params.entryId));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/entries/:entryId/attachments', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  try {
    const r = db.prepare('INSERT INTO changelog_attachments (entry_id, filename, filepath, size, mimetype, created_at) VALUES (?,?,?,?,?,?)').run(req.params.entryId, req.file.originalname, req.file.path, req.file.size, req.file.mimetype, new Date().toISOString());
    res.status(201).json({ id: r.lastInsertRowid, filename: req.file.originalname });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.get('/attachments/:id/download', authMiddleware, (req, res) => {
  try {
    const att = db.prepare('SELECT * FROM changelog_attachments WHERE id=?').get(req.params.id);
    if (!att) return res.status(404).json({ error: 'Arquivo não encontrado' });
    res.download(att.filepath, att.filename);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/attachments/:id', authMiddleware, (req, res) => {
  try {
    const att = db.prepare('SELECT * FROM changelog_attachments WHERE id=?').get(req.params.id);
    if (att) { try { fs.unlinkSync(att.filepath); } catch {} db.prepare('DELETE FROM changelog_attachments WHERE id=?').run(req.params.id); }
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
