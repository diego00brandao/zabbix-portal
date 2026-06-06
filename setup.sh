#!/bin/bash
# ============================================================
# Zabbix Portal - Setup Automatizado
# ============================================================
set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔════════════════════════════════════════╗"
echo "║   🏦 Zabbix Portal - Setup             ║"
echo "╚════════════════════════════════════════╝"
echo -e "${NC}"

# Verifica Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Instale Node.js 18+ primeiro."
    exit 1
fi
NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VER" -lt 18 ]; then
    echo "❌ Node.js 18+ requerido. Versão atual: $(node -v)"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v) detectado${NC}"

# Instala dependências backend
echo ""
echo -e "${BLUE}[1/3] Instalando dependências do backend...${NC}"
cd backend
npm install --silent
cd ..
echo -e "${GREEN}✓ Backend OK${NC}"

# Configura .env
echo ""
echo -e "${BLUE}[2/3] Configurando ambiente...${NC}"
if [ ! -f "backend/.env" ]; then
    cp backend/.env.example backend/.env
    echo -e "${YELLOW}⚠  Arquivo backend/.env criado a partir do .env.example"
    echo "   Edite as variáveis ZABBIX_URL, ZABBIX_USER, ZABBIX_PASSWORD antes de iniciar.${NC}"
else
    echo -e "${GREEN}✓ backend/.env já existe${NC}"
fi

# Instala dependências frontend
echo ""
echo -e "${BLUE}[3/3] Instalando dependências do frontend...${NC}"
cd frontend
npm install --silent
cd ..
echo -e "${GREEN}✓ Frontend OK${NC}"

echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Setup concluído!${NC}"
echo ""
echo "Próximos passos:"
echo -e "  1. Edite ${YELLOW}backend/.env${NC} com a URL e credenciais do Zabbix"
echo ""
echo "Para iniciar:"
echo -e "  Terminal 1: ${BLUE}cd backend && npm run dev${NC}"
echo -e "  Terminal 2: ${BLUE}cd frontend && npm run dev${NC}"
echo ""
echo -e "  Acesse: ${BLUE}http://localhost:3000${NC}"
echo -e "  Login:  ${YELLOW}admin / Admin@2024!${NC}"
echo ""
