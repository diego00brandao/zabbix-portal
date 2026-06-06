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

module.exports = router;
