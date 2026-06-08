require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { initDB } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
}));
app.use(express.json());

app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Muitas tentativas. Aguarde 15 minutos.' },
}));

app.use('/api/', rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 200,
  message: { error: 'Limite de requisições atingido.' },
}));

app.use('/api/auth',    require('./routes/auth'));
app.use('/api/zabbix',  require('./routes/zabbix'));
app.use('/api/admin',   require('./routes/admin'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/changelog', require('./routes/changelog'));
app.use('/api/dashboard-links', require('./routes/dashboard_links'));
app.use('/api/alfred', require('./routes/alfred'));
app.use('/mcp', require('./routes/mcp'));
app.use('/api/connections', require('./routes/connections'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════╗
║   🏦 Zabbix Portal - Backend           ║
║   Porta: ${PORT}                          ║
║   Ambiente: ${process.env.NODE_ENV || 'development'}               ║
╚════════════════════════════════════════╝
    `);
  });
}).catch(err => {
  console.error('Erro ao iniciar banco:', err);
  process.exit(1);
});