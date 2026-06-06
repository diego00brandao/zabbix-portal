# 🏦 Zabbix Portal — Portal de Monitoração

Portal web para visualização de dados do Zabbix, com controle de acesso por área.
Desenvolvido para uso interno no Banco PAN e BTG Pactual.

---

## 📁 Estrutura do Projeto

```
zabbix-portal/
├── backend/               # Node.js + Express + SQLite
│   ├── db/
│   │   └── database.js    # Schema SQLite + helpers de cache
│   ├── middleware/
│   │   └── auth.js        # JWT auth middleware
│   ├── routes/
│   │   ├── auth.js        # Login / logout / /me
│   │   ├── zabbix.js      # Dados do Zabbix (hosts, triggers, itens...)
│   │   ├── admin.js       # Gerenciar usuários e áreas
│   │   └── reports.js     # Exportação CSV/JSON
│   ├── services/
│   │   └── zabbix.js      # Integração com a API do Zabbix
│   ├── server.js          # Entry point
│   ├── .env.example       # Modelo de configuração
│   └── package.json
│
├── frontend/              # React + Vite
│   ├── src/
│   │   ├── components/
│   │   │   └── Layout.jsx           # Sidebar + roteamento
│   │   ├── context/
│   │   │   └── AuthContext.jsx      # Auth state global
│   │   ├── pages/
│   │   │   ├── Login.jsx            # Tela de login
│   │   │   ├── Dashboard.jsx        # KPIs + gráficos
│   │   │   ├── Triggers.jsx         # Alertas ativos
│   │   │   ├── Items.jsx            # Itens + queries SQL
│   │   │   ├── Reports.jsx          # Exportações
│   │   │   └── HostsAndTemplates.jsx
│   │   ├── services/
│   │   │   └── api.js               # Axios configurado
│   │   ├── App.jsx                  # Rotas protegidas
│   │   └── index.css                # Design system
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
└── setup.sh               # Setup automatizado
```

---

## 🚀 Como Instalar

### Pré-requisitos
- Node.js **18+**
- Acesso à API do Zabbix (testado no Zabbix 6.x e 7.x)

### 1. Setup automático
```bash
chmod +x setup.sh
./setup.sh
```

### 2. Configure o Zabbix
Edite `backend/.env`:
```env
ZABBIX_URL=http://SEU_ZABBIX/zabbix/api_jsonrpc.php
ZABBIX_USER=Admin
ZABBIX_PASSWORD=suasenha
JWT_SECRET=troque_por_string_aleatoria_forte
```

### 3. Inicie os servidores

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
# Roda em http://localhost:3001
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
# Roda em http://localhost:3000
```

### 4. Acesse
- URL: http://localhost:3000
- Login padrão: `admin` / `Admin@2024!`

---

## 👥 Gerenciar Áreas e Usuários

### Via API (admin)

**Criar área:**
```bash
curl -X POST http://localhost:3001/api/admin/areas \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Banco de Dados",
    "description": "Oracle, SQL Server, PostgreSQL",
    "color": "#F59E0B",
    "zabbix_hostgroup_ids": ["10", "23"]  ← IDs do Zabbix
  }'
```

**Listar hostgroups do Zabbix (para descobrir os IDs):**
```bash
curl http://localhost:3001/api/zabbix/hostgroups \
  -H "Authorization: Bearer SEU_TOKEN"
```

**Criar usuário para uma área:**
```bash
curl -X POST http://localhost:3001/api/admin/users \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "joao.silva",
    "password": "Senha@123",
    "full_name": "João Silva",
    "email": "joao@pan.com.br",
    "role": "viewer",
    "area_id": 1
  }'
```

### Roles
| Role     | Acesso                               |
|----------|--------------------------------------|
| admin    | Tudo (incluindo admin de usuários)   |
| manager  | Dashboard + relatórios da sua área   |
| viewer   | Somente visualização da sua área     |

---

## 🔒 Segurança

- Autenticação JWT com expiração de 8h
- Rate limiting: 10 tentativas de login por 15 min
- Usuários vinculados a áreas veem **apenas** dados dos hostgroups configurados
- Admin vê tudo sem filtro
- Log de acessos em SQLite

---

## 📊 API Endpoints

| Método | Endpoint                        | Descrição               |
|--------|---------------------------------|-------------------------|
| POST   | /api/auth/login                 | Login                   |
| GET    | /api/auth/me                    | Dados do usuário logado |
| GET    | /api/zabbix/dashboard           | KPIs do dashboard       |
| GET    | /api/zabbix/hosts               | Lista de hosts          |
| GET    | /api/zabbix/triggers/active     | Alertas ativos          |
| GET    | /api/zabbix/items               | Itens monitorados       |
| GET    | /api/zabbix/items/queries       | Só itens com query SQL  |
| GET    | /api/zabbix/templates           | Templates               |
| GET    | /api/reports/hosts?format=csv   | Exportar hosts CSV      |
| GET    | /api/reports/triggers?format=csv| Exportar alertas CSV    |
| GET    | /api/reports/items?format=csv   | Exportar itens CSV      |

---

## 🔧 Customizações Comuns

**Aumentar cache da API Zabbix** (padrão: 60-300s):
Em `backend/services/zabbix.js`, altere o terceiro parâmetro de `call()`.

**Adicionar nova área via SQL:**
```bash
cd backend
node -e "
const {db} = require('./db/database');
db.prepare(\`INSERT INTO areas (name, color, zabbix_hostgroup_ids) VALUES (?,?,?)\`)
  .run('Redes', '#10B981', JSON.stringify(['15','16']));
console.log('Área criada');
"
```

---

## 🐛 Troubleshooting

**"Não foi possível conectar ao Zabbix"**
→ Verifique `ZABBIX_URL` no `.env`. Tente acessar a URL no browser.

**"Falha na autenticação Zabbix"**
→ Verifique `ZABBIX_USER` e `ZABBIX_PASSWORD`. O usuário precisa ter acesso à API.

**Dados aparecem vazios para minha área**
→ O admin precisa configurar os `zabbix_hostgroup_ids` da área com os IDs corretos do Zabbix.
   Use `GET /api/zabbix/hostgroups` para listar os IDs disponíveis.
