const express = require('express');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { db } = require('../db/database');
const axios = require('axios');
const router = express.Router();

// Listar conexões (admin vê todas, viewer vê só as da sua área)
router.get('/', authMiddleware, (req, res) => {
  try {
    if (req.user.role === 'admin' || req.user.role === 'manager') {
      const conns = db.prepare('SELECT id, name, url, auth_type, username, active, created_at, updated_at FROM zabbix_connections ORDER BY created_at DESC').all();
      return res.json(conns);
    }
    const user = db.prepare('SELECT area_id FROM users WHERE id=?').get(req.user.id);
    if (!user?.area_id) return res.json([]);
    const area = db.prepare('SELECT zabbix_connection_ids FROM areas WHERE id=?').get(user.area_id);
    if (!area) return res.json([]);
    const connIds = JSON.parse(area.zabbix_connection_ids || '[]');
    if (connIds.length === 0) return res.json([]);
    const placeholders = connIds.map(() => '?').join(',');
    const conns = db.prepare(`SELECT id, name, url, auth_type, username, active, created_at, updated_at FROM zabbix_connections WHERE id IN (${placeholders}) ORDER BY created_at DESC`).all(...connIds);
    res.json(conns);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Criar conexão
router.post('/', authMiddleware, adminOnly, (req, res) => {
  try {
    const { name, url, auth_type, token, username, password } = req.body;
    if (!name || !url) return res.status(400).json({ error: 'Nome e URL são obrigatórios' });
    if (auth_type === 'token' && !token) return res.status(400).json({ error: 'Token é obrigatório' });
    if (auth_type === 'userpass' && (!username || !password)) return res.status(400).json({ error: 'Usuário e senha são obrigatórios' });
    const result = db.prepare(
      'INSERT INTO zabbix_connections (name, url, auth_type, token, username, password, active) VALUES (?,?,?,?,?,?,0)'
    ).run(name, url.trim(), auth_type || 'token', token || null, username || null, password || null);
    res.json({ id: result.lastInsertRowid, message: 'Conexão criada com sucesso' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Atualizar conexão
router.put('/:id', authMiddleware, adminOnly, (req, res) => {
  try {
    const { name, url, auth_type, token, username, password } = req.body;
    db.prepare(
      'UPDATE zabbix_connections SET name=?, url=?, auth_type=?, token=?, username=?, password=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
    ).run(name, url.trim(), auth_type, token || null, username || null, password || null, req.params.id);
    res.json({ message: 'Conexão atualizada' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Deletar conexão
router.delete('/:id', authMiddleware, adminOnly, (req, res) => {
  try {
    const conn = db.prepare('SELECT active FROM zabbix_connections WHERE id=?').get(req.params.id);
    if (conn?.active) return res.status(400).json({ error: 'Não é possível deletar a conexão ativa' });
    db.prepare('DELETE FROM zabbix_connections WHERE id=?').run(req.params.id);
    res.json({ message: 'Conexão removida' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Ativar conexão
router.post('/:id/activate', authMiddleware, adminOnly, async (req, res) => {
  try {
    db.prepare('UPDATE zabbix_connections SET active=0').run();
    db.prepare('UPDATE zabbix_connections SET active=1 WHERE id=?').run(req.params.id);
    // Limpa o cache para forçar reconexão
    db.prepare('DELETE FROM zabbix_cache').run();
    res.json({ message: 'Conexão ativada com sucesso' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Usar .env (desativar todas)
router.post('/use-env', authMiddleware, adminOnly, (req, res) => {
  try {
    db.prepare('UPDATE zabbix_connections SET active=0').run();
    db.prepare('DELETE FROM zabbix_cache').run();
    res.json({ message: 'Usando configuração do .env' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Testar conexão
router.post('/test', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { url, auth_type, token, username, password } = req.body;
    if (!url) return res.status(400).json({ error: 'URL é obrigatória' });

    const api = axios.create({ timeout: 8000, headers: { 'Content-Type': 'application/json' } });

    // Primeiro testa a versão da API
    const versionRes = await api.post(url, {
      jsonrpc: '2.0', method: 'apiinfo.version', params: {}, id: 1,
    });
    const version = versionRes.data.result;

    let authToken = null;
    if (auth_type === 'token' && token) {
      authToken = token;
    } else if (auth_type === 'userpass' && username && password) {
      const loginRes = await api.post(url, {
        jsonrpc: '2.0', method: 'user.login',
        params: { username, password }, auth: null, id: 1,
      });
      if (loginRes.data.error) throw new Error(loginRes.data.error.message);
      authToken = loginRes.data.result;
    }

    // Testa uma chamada autenticada
    const testRes = await api.post(url, {
      jsonrpc: '2.0', method: 'host.get',
      params: { output: 'count', countOutput: true },
      auth: authToken, id: 1,
    });
    if (testRes.data.error) throw new Error(testRes.data.error.message);

    res.json({ success: true, version, hosts: testRes.data.result });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

router.post('/select', authMiddleware, (req, res) => {
  const { id } = req.body;
  // Store selected connection in user session via token payload would require JWT regen
  // Instead, frontend sends connection id on each request via header
  res.json({ success: true, id });
});

module.exports = router;