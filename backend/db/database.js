const Database = require('sql.js');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DB_PATH || './db/portal.db';
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

let db;

async function initDB() {
  const SQL = await Database();
  
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  function save() {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS areas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      color TEXT DEFAULT '#3B82F6',
      zabbix_hostgroup_ids TEXT DEFAULT '[]',
      zabbix_template_ids TEXT DEFAULT '[]',
      zabbix_group_ids TEXT DEFAULT '[]',
      zabbix_connection_ids TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT,
      role TEXT DEFAULT 'viewer',
      area_id INTEGER,
      active INTEGER DEFAULT 1,
      last_login DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS access_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      ip TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS zabbix_cache (
      cache_key TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dashboard_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      tool_type TEXT DEFAULT 'outro',
      description TEXT
    );
    CREATE TABLE IF NOT EXISTS host_metadata (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hostid TEXT,
      hostname TEXT,
      responsible TEXT,
      criticality TEXT,
      notes TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS changelog_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS changelog_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      title TEXT,
      description TEXT,
      related_resource TEXT,
      resource_type TEXT,
      ticket TEXT,
      status TEXT DEFAULT 'todo',
      progress INTEGER DEFAULT 0,
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS changelog_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER,
      filename TEXT,
      filepath TEXT,
      size INTEGER,
      mimetype TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS zabbix_connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      auth_type TEXT DEFAULT 'token',
      token TEXT,
      username TEXT,
      password TEXT,
      active INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migração — adiciona colunas se não existirem
  try { db.run(`ALTER TABLE areas ADD COLUMN zabbix_template_ids TEXT DEFAULT '[]'`); } catch {}
  try { db.run(`ALTER TABLE areas ADD COLUMN zabbix_connection_ids TEXT DEFAULT '[]'`); } catch {}
  try { db.run(`ALTER TABLE areas ADD COLUMN zabbix_group_ids TEXT DEFAULT '[]'`); } catch {}

  const areas = [
    ['Banco de Dados', 'Oracle, SQL Server, PostgreSQL, MongoDB', '#F59E0B', '[]'],
    ['Redes e Infraestrutura', 'Switches, Firewalls, Roteadores', '#10B981', '[]'],
    ['Aplicações', 'APIs, Microserviços, Web Apps', '#3B82F6', '[]'],
    ['Segurança', 'WAF, IDS/IPS, Certificados', '#EF4444', '[]'],
    ['Cloud', 'AWS, Azure, GCP', '#8B5CF6', '[]'],
  ];
  for (const a of areas) {
    db.run(`INSERT OR IGNORE INTO areas (name, description, color, zabbix_hostgroup_ids) VALUES (?,?,?,?)`, a);
  }

  const res = db.exec(`SELECT id FROM users WHERE username = 'admin'`);
  if (!res.length || !res[0].values.length) {
    const hash = bcrypt.hashSync('Admin@2024!', 12);
    db.run(`INSERT INTO users (username, password_hash, full_name, email, role) VALUES (?,?,?,?,?)`,
      ['admin', hash, 'Administrador do Portal', 'admin@pan.com.br', 'admin']);
    console.log('✅ Usuário admin criado: admin / Admin@2024!');
  }

  save();
  console.log('✅ Banco inicializado');

  db.prepare = (sql) => ({
    get: (...params) => {
      const res = db.exec(sql, params);
      if (!res.length || !res[0].values.length) return undefined;
      const cols = res[0].columns;
      const row = res[0].values[0];
      return Object.fromEntries(cols.map((c, i) => [c, row[i]]));
    },
    all: (...params) => {
      const res = db.exec(sql, params);
      if (!res.length) return [];
      const cols = res[0].columns;
      return res[0].values.map(row => Object.fromEntries(cols.map((c, i) => [c, row[i]])));
    },
    run: (...params) => {
      db.run(sql, params);
      save();
      return { lastInsertRowid: db.exec('SELECT last_insert_rowid()')[0]?.values[0][0] };
    },
  });

  return db;
}


const memCache = new Map();

function getCached(key) {
  const mem = memCache.get(key);
  if (mem && mem.expires > Date.now()) return mem.data;
  if (mem) memCache.delete(key);
  try {
    const res = db.exec(`SELECT data FROM zabbix_cache WHERE cache_key = ? AND expires_at > datetime('now')`, [key]);
    if (!res.length || !res[0].values.length) return null;
    return JSON.parse(res[0].values[0][0]);
  } catch { return null; }
}

function setCache(key, data, ttlSeconds = 60) {
  memCache.set(key, { data, expires: Date.now() + ttlSeconds * 1000 });
  try {
    db.run(`INSERT OR REPLACE INTO zabbix_cache (cache_key, data, expires_at) VALUES (?, ?, datetime('now', ? || ' seconds'))`,
      [key, JSON.stringify(data), String(ttlSeconds)]);
  } catch {}
}

module.exports = { db: new Proxy({}, { get: (_, p) => db?.[p] }), initDB, getCached, setCache };