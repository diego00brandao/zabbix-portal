# Zabbix Observability Portal

Portal web para monitoração e observabilidade construído sobre o Zabbix 6.0.42, oferecendo uma interface limpa e role-based para times não-técnicos.

## Stack

- **Backend:** Node.js + Express (porta 3001)
- **Frontend:** React + Vite
- **Banco:** SQLite (sql.js)
- **Proxy:** Nginx
- **API externa:** Zabbix 6.0.42 via JSON-RPC

## Features

- Dashboard com KPIs, top hosts com problemas e histórico de alertas
- Itens & Triggers unificado por template (com filtros LLD)
- Multi-Zabbix: trocar entre conexões pós-login
- Filtros por tecnologia (Database, Linux, Windows, Rede)
- Change Log com projetos e atividades + upload de anexos
- Audit Log com filtros por período e tipo
- Relatórios consolidados (CSV, PDF, Excel)
- Controle de acesso por área e role (admin/manager/viewer)
- MCP server para integração com Claude (Alfred IA)
- Ferramentas externas configuráveis no Dashboard

## Setup

### Docker (recomendado)
Ver [docs/DOCKER.md](docs/DOCKER.md) para instruções completas.

```bash
git clone https://github.com/diego00brandao/zabbix-portal.git
cd zabbix-portal
cp .env.example .env
# edita .env
docker compose up -d --build
# acessa http://localhost:8080/portal/
```

### Manual (desenvolvimento)
```bash
# Backend
cd backend
npm install
node server.js  # porta 3001

# Frontend (outro terminal)
cd frontend
npm install
npm run dev
```

## Estrutura

```
zabbix-portal/
├── backend/              # API Node.js/Express
│   ├── routes/           # auth, admin, connections, zabbix, reports, changelog, alfred, mcp...
│   ├── services/         # zabbix.js (cliente JSON-RPC)
│   ├── middleware/       # auth, area filtering
│   ├── db/               # SQLite portal.db
│   └── Dockerfile
├── frontend/             # React + Vite
│   ├── src/pages/        # Dashboard, Alertas, Servidores, Itens & Triggers, Change Log...
│   ├── src/components/   # Layout, AuthContext
│   ├── nginx.conf        # config do container
│   └── Dockerfile
├── docs/
│   ├── DOCKER.md         # instruções de deploy via Docker
│   └── prod-configs/     # configs de referência do ambiente de produção
└── docker-compose.yml
```

## Deploy em produção (offline)

Ver [docs/DOCKER.md](docs/DOCKER.md) — seção "Deploy offline".

## Tecnologias monitoradas

Detecção automática por padrão de nome de host:
- **SQL Server** — `MSSQL`, `PSQL`, `ORACLE`, `BD`
- **Linux** — `LNX`, `LINUX`
- **Windows** — `WIN`, `WND`, `SRV`
- **Rede** — `RTR`, `SW`, `FW`, `NET`

## Roles

| Role     | Acesso                                                                |
|----------|-----------------------------------------------------------------------|
| admin    | Tudo: usuários, áreas, conexões, ferramentas, todos os dados          |
| manager  | Templates, ferramentas, todos os dados                                |
| viewer   | Itens & Triggers do template da sua área, alertas, servidores         |

## Out of scope

- SLA reporting
- War Room / Incident management (usar ServiceNow)
- Health scores
- On-call / escalation
- SSL certificate management
