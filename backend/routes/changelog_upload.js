const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { db } = require('../db/database');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '../uploads/changelog');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

router.post('/entries/:entryId/attachments', authMiddleware, express.json({limit:'50mb'}), (req, res) => {
  const { filename, data, mimetype } = req.body;
  if (!filename || !data) return res.status(400).json({ error: 'filename e data são obrigatórios' });
  try {
    const unique = Date.now() + '-' + Math.round(Math.random()*1e6);
    const ext = path.extname(filename);
    const filepath = path.join(UPLOAD_DIR, unique + ext);
    const buffer = Buffer.from(data, 'base64');
    fs.writeFileSync(filepath, buffer);
    const r = db.prepare('INSERT INTO changelog_attachments (entry_id, filename, filepath, size, mimetype, created_at) VALUES (?,?,?,?,?,?)').run(req.params.entryId, filename, filepath, buffer.length, mimetype||'', new Date().toISOString());
    res.status(201).json({ id: r.lastInsertRowid, filename });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
