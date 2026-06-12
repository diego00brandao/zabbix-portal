const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { db } = require('../db/database');
const router = express.Router();

router.get('/:hostid', authMiddleware, (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM host_metadata WHERE hostid=?').get(req.params.hostid);
    res.json(row || { hostid: req.params.hostid, responsible: '', criticality: 'medium', notes: '' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

router.put('/:hostid', authMiddleware, (req, res) => {
  const { responsible, criticality, notes, hostname } = req.body;
  try {
    db.prepare(`INSERT INTO host_metadata (hostid, hostname, responsible, criticality, notes, updated_at)
      VALUES (?,?,?,?,?,?)
      ON CONFLICT(hostid) DO UPDATE SET responsible=?,criticality=?,notes=?,updated_at=?`
    ).run(req.params.hostid, hostname||'', responsible||'', criticality||'medium', notes||'', new Date().toISOString(),
          responsible||'', criticality||'medium', notes||'', new Date().toISOString());
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
