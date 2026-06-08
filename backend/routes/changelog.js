const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { db } = require('../db/database');
const router = express.Router();

router.get('/', authMiddleware, (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM changelog ORDER BY created_at DESC').all();
    res.json(rows);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/', authMiddleware, (req, res) => {
  const { title, description, related_resource, resource_type, ticket, status, progress } = req.body;
  if (!title) return res.status(400).json({ error: 'Título é obrigatório' });
  try {
    const result = db.prepare(
      'INSERT INTO changelog (title, description, related_resource, resource_type, ticket, status, progress, created_by, created_at) VALUES (?,?,?,?,?,?,?,?,?)'
    ).run(title, description||'', related_resource||'', resource_type||'host', ticket||'', status||'To Do', progress||0, req.user.username, new Date().toISOString());
    res.status(201).json({ id: result.lastInsertRowid });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authMiddleware, (req, res) => {
  const { title, description, related_resource, resource_type, ticket, status, progress } = req.body;
  try {
    db.prepare('UPDATE changelog SET title=?,description=?,related_resource=?,resource_type=?,ticket=?,status=?,progress=?,updated_at=? WHERE id=?')
      .run(title, description||'', related_resource||'', resource_type||'host', ticket||'', status||'To Do', progress||0, new Date().toISOString(), req.params.id);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authMiddleware, (req, res) => {
  try {
    db.prepare('DELETE FROM changelog WHERE id=?').run(req.params.id);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
