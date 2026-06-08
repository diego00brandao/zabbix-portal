const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { db } = require('../db/database');
const router = express.Router();

router.get('/', authMiddleware, (req, res) => {
  try { res.json(db.prepare('SELECT * FROM dashboard_links ORDER BY name').all()); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

router.post('/', authMiddleware, (req, res) => {
  const { name, url, tool_type, description } = req.body;
  if (!name || !url) return res.status(400).json({ error: 'Nome e URL são obrigatórios' });
  try {
    const r = db.prepare('INSERT INTO dashboard_links (name, url, tool_type, description) VALUES (?,?,?,?)').run(name, url, tool_type||'outro', description||'');
    res.status(201).json({ id: r.lastInsertRowid });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', authMiddleware, (req, res) => {
  const { name, url, tool_type, description } = req.body;
  try {
    db.prepare('UPDATE dashboard_links SET name=?,url=?,tool_type=?,description=? WHERE id=?').run(name, url, tool_type||'outro', description||'', req.params.id);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', authMiddleware, (req, res) => {
  try { db.prepare('DELETE FROM dashboard_links WHERE id=?').run(req.params.id); res.json({ success: true }); }
  catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
