const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha obrigatórios' });
  }

  const user = db.prepare(`
    SELECT u.*, a.name as area_name, a.color as area_color, a.zabbix_hostgroup_ids
    FROM users u
    LEFT JOIN areas a ON u.area_id = a.id
    WHERE u.username = ? AND u.active = 1
  `).get(username.toLowerCase().trim());

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    // Log tentativa falha
    db.prepare(`INSERT INTO access_logs (user_id, action, ip) VALUES (?, ?, ?)`)
      .run(user?.id || null, 'login_failed', req.ip);
    return res.status(401).json({ error: 'Credenciais inválidas' });
  }

  // Atualiza last_login
  db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
  db.prepare(`INSERT INTO access_logs (user_id, action, ip) VALUES (?, ?, ?)`)
    .run(user.id, 'login_success', req.ip);

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
      areaId: user.area_id,
      areaName: user.area_name,
      areaColor: user.area_color,
      hostgroupIds: JSON.parse(user.zabbix_hostgroup_ids || '[]'),
    },
  });
});

// POST /api/auth/logout
router.post('/logout', authMiddleware, (req, res) => {
  db.prepare(`INSERT INTO access_logs (user_id, action, ip) VALUES (?, ?, ?)`)
    .run(req.user.id, 'logout', req.ip);
  res.json({ message: 'Logout realizado' });
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare(`
    SELECT u.id, u.username, u.full_name, u.email, u.role, u.last_login,
           a.name as area_name, a.color as area_color, a.zabbix_hostgroup_ids
    FROM users u
    LEFT JOIN areas a ON u.area_id = a.id
    WHERE u.id = ?
  `).get(req.user.id);

  res.json({
    id: user.id,
    username: user.username,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    lastLogin: user.last_login,
    areaName: user.area_name,
    areaColor: user.area_color,
    hostgroupIds: JSON.parse(user.zabbix_hostgroup_ids || '[]'),
  });
});

router.post('/reset-password', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username e senha são obrigatórios' });
  if (password.length < 8) return res.status(400).json({ error: 'Senha deve ter pelo menos 8 caracteres' });
  const bcrypt = require('bcryptjs');
  const { db } = require('../db/database');
  const user = db.prepare('SELECT id FROM users WHERE username=? AND active=1').get(username.toLowerCase());
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
  const hash = bcrypt.hashSync(password, 12);
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, user.id);
  res.json({ success: true });
});

router.post('/register', async (req, res) => {
  const { username, password, full_name, email } = req.body;
  if (!username || !password || !full_name) return res.status(400).json({ error: 'username, password e full_name são obrigatórios' });
  if (password.length < 8) return res.status(400).json({ error: 'Senha deve ter pelo menos 8 caracteres' });
  const bcrypt = require('bcryptjs');
  const { db } = require('../db/database');
  try {
    const hash = bcrypt.hashSync(password, 12);
    db.prepare('INSERT INTO users (username, password_hash, full_name, email, role, active, pending) VALUES (?, ?, ?, ?, ?, 0, 1)')
      .run(username.toLowerCase(), hash, full_name, email || null, 'viewer');
    res.status(201).json({ success: true });
  } catch (err) {
    if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Username já existe' });
    throw err;
  }
});

module.exports = router;
