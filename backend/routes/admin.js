const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db/database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

// ── ÁREAS ──────────────────────────────────────────────────────

router.get('/areas', authMiddleware, (req, res) => {
  const areas = db.prepare(`
    SELECT a.*, COUNT(u.id) as user_count
    FROM areas a
    LEFT JOIN users u ON u.area_id = a.id AND u.active = 1
    GROUP BY a.id
    ORDER BY a.name
  `).all();
  res.json(areas.map(a => ({
    ...a,
    zabbix_hostgroup_ids: JSON.parse(a.zabbix_hostgroup_ids || '[]'),
    zabbix_template_ids: JSON.parse(a.zabbix_template_ids || '[]'),
    zabbix_connection_ids: JSON.parse(a.zabbix_connection_ids || '[]'),
  })));
});

router.post('/areas', authMiddleware, adminOnly, (req, res) => {
  const { name, description, color, zabbix_hostgroup_ids, zabbix_template_ids, zabbix_connection_ids } = req.body;
  if (!name) return res.status(400).json({ error: 'Nome obrigatório' });
  try {
    const result = db.prepare(`
      INSERT INTO areas (name, description, color, zabbix_hostgroup_ids, zabbix_template_ids, zabbix_connection_ids)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, description || '', color || '#3B82F6', JSON.stringify(zabbix_hostgroup_ids || []), JSON.stringify(zabbix_template_ids || []), JSON.stringify(zabbix_connection_ids || []));
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Área já existe' });
    throw err;
  }
});

router.put('/areas/:id', authMiddleware, adminOnly, (req, res) => {
  const { name, description, color, zabbix_hostgroup_ids, zabbix_template_ids, zabbix_connection_ids } = req.body;
  db.prepare(`
    UPDATE areas SET name=?, description=?, color=?, zabbix_hostgroup_ids=?, zabbix_template_ids=?, zabbix_connection_ids=?
    WHERE id=?
  `).run(name, description, color, JSON.stringify(zabbix_hostgroup_ids || []), JSON.stringify(zabbix_template_ids || []), JSON.stringify(zabbix_connection_ids || []), req.params.id);
  res.json({ success: true });
});

// ── USUÁRIOS ───────────────────────────────────────────────────

router.get('/users', authMiddleware, adminOnly, (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.username, u.full_name, u.email, u.role, u.active, u.last_login, u.created_at,
           a.name as area_name, a.color as area_color
    FROM users u
    LEFT JOIN areas a ON u.area_id = a.id
    ORDER BY u.full_name
  `).all();
  res.json(users);
});

router.post('/users', authMiddleware, adminOnly, (req, res) => {
  const { username, password, full_name, email, role, area_id } = req.body;
  if (!username || !password || !full_name) {
    return res.status(400).json({ error: 'username, password e full_name são obrigatórios' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Senha deve ter pelo menos 8 caracteres' });
  }
  try {
    const hash = bcrypt.hashSync(password, 12);
    const result = db.prepare(`
      INSERT INTO users (username, password_hash, full_name, email, role, area_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(username.toLowerCase(), hash, full_name, email || null, role || 'viewer', area_id || null);
    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Username já existe' });
    throw err;
  }
});

router.put('/users/:id', authMiddleware, adminOnly, (req, res) => {
  const { full_name, email, role, area_id, active, password } = req.body;
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  if (password) {
    if (password.length < 8) return res.status(400).json({ error: 'Senha deve ter pelo menos 8 caracteres' });
    const hash = bcrypt.hashSync(password, 12);
    db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, req.params.id);
  }
  db.prepare(`
    UPDATE users SET full_name=?, email=?, role=?, area_id=?, active=?
    WHERE id=?
  `).run(full_name, email, role, area_id || null, active ? 1 : 0, req.params.id);
  res.json({ success: true });
});

router.delete('/users/:id', authMiddleware, adminOnly, (req, res) => {
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'Não é possível desativar seu próprio usuário' });
  }
  db.prepare('UPDATE users SET active=0 WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

router.get('/logs', authMiddleware, adminOnly, (req, res) => {
  const logs = db.prepare(`
    SELECT l.*, u.username, u.full_name
    FROM access_logs l
    LEFT JOIN users u ON l.user_id = u.id
    ORDER BY l.created_at DESC
    LIMIT 200
  `).all();
  res.json(logs);
});

module.exports = router;