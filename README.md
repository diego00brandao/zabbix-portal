# 🚀 Observability Portal

Plataforma corporativa de observabilidade e operação desenvolvida sobre o ecossistema do Zabbix.

O Observability Portal centraliza informações operacionais, auditoria, alertas, tendências, inventário e métricas do ambiente em uma interface moderna baseada em React + Node.js.

---

# 🏗️ Arquitetura

```text
Usuário
   ↓
Nginx HTTPS
   ↓
Frontend React (/portal)
   ↓
Backend Node.js (/api)
   ↓
API Zabbix
```

---

# ⚙️ Stack Tecnológica

## Frontend

* React 18
* Vite
* React Router DOM
* Axios
* Recharts
* Context API

## Backend

* Node.js
* Express.js
* JWT Authentication
* Axios
* SQL.js / SQLite

## Infraestrutura

* Linux
* Nginx Reverse Proxy
* systemd
* HTTPS/TLS

---

# 📁 Estrutura do Projeto

```text
zabbix-portal/
├── backend/
│   ├── db/
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   ├── package.json
│   └── server.js
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── App.jsx
│   │   └── main.jsx
│   │
│   ├── dist/
│   ├── package.json
│   └── vite.config.js
│
├── setup.sh
└── README.md
```

---

# 🔐 Funcionalidades

## Observabilidade

* Dashboard operacional
* Timeline
* Histórico de alertas
* Triggers ativas
* Inventário de hosts
* Templates
* Itens monitorados
* e muito mais...

## Administração

* Gestão de usuários
* Gestão de áreas
* Aprovação de usuários
* Controle de acesso por área

## Auditoria

* Audit trail
* Histórico operacional
* Timeline de mudanças
* e muito mais...

## Multi-Connections

* Múltiplos ambientes Zabbix
* Seleção dinâmica de ambiente

## Exportação

* CSV
* JSON
* Excel

---

# 🔑 Controle de Acesso

| Perfil  | Permissões         |
| ------- | ------------------ |
| admin   | Controle total     |
| manager | Gestão operacional |
| viewer  | Somente leitura    |

---

# 🚀 Deploy Produção

## Backend

```bash
cd /opt/zabbix-portal/backend
npm install
sudo systemctl restart zabbix-portal
```

## Frontend

```bash
cd /opt/zabbix-portal/frontend
npm install
npm run build -- --base=/portal/
sudo systemctl reload nginx
```

---

# 🌐 Nginx

## Portal React

```nginx
location ^~ /portal {
    alias /opt/zabbix-portal/frontend/dist/;
    try_files $uri $uri/ /portal/index.html;
}
```

## Backend API

```nginx
location ^~ /api/ {
    proxy_pass http://localhost:3001;
}
```

---

# 🧠 Backend API

## Principais endpoints

| Método | Endpoint                    | Descrição     |
| ------ | --------------------------- | ------------- |
| POST   | /api/auth/login             | Login         |
| GET    | /api/auth/me                | Usuário atual |
| GET    | /api/zabbix/dashboard       | Dashboard     |
| GET    | /api/zabbix/hosts           | Hosts         |
| GET    | /api/zabbix/triggers/active | Alertas       |
| GET    | /api/zabbix/items           | Itens         |
| GET    | /api/reports/*              | Exportações   |
| GET    | /api/connections            | Ambientes     |

---

# 🛡️ Segurança

* JWT Authentication
* Middleware de autenticação
* Rate Limiting
* Controle RBAC
* Segmentação por área
* HTTPS Reverse Proxy
* Sessão autenticada

---

# 📊 Observabilidade Operacional

O portal implementa conceitos de observabilidade operacional para:

* visualização consolidada
* troubleshooting
* análise de tendências
* acompanhamento de incidentes
* correlação operacional

---

# 🐧 Ambiente Linux

## Serviço systemd

```bash
systemctl status zabbix-portal
journalctl -u zabbix-portal -f
```

## Nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

# 👨‍💻 Autor

Diego Brandão
GitHub: https://github.com/diego00brandao
