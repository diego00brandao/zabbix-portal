# Zabbix Portal — Docker

## Estrutura
- `backend/` — API Node.js/Express (porta 3001 interna)
- `frontend/` — React build servido via Nginx (porta 80 interna → 8080 exposta)
- Volumes: `portal-db` (SQLite) e `portal-uploads` (anexos do Change Log)

## Setup local
1. Copia o `.env.example` pra `.env` na raiz e preenche
2. Coloca o `backend/Dockerfile` em `backend/`
3. Coloca o `frontend/Dockerfile` e `nginx.conf` em `frontend/`
4. Sobe: `docker compose up -d --build`
5. Acessa: http://localhost:8080/portal/

## Deploy offline (servidor sem internet)
No seu PC (com internet):
```bash
docker compose build
docker save zabbix-portal-backend zabbix-portal-frontend | gzip > portal-images.tar.gz
```

Transfere pra produção via SCP:
```bash
scp portal-images.tar.gz svc_zabbix@10.145.141.24:/tmp/
scp docker-compose.yml .env svc_zabbix@10.145.141.24:/opt/zabbix-portal-docker/
```

No servidor:
```bash
cd /opt/zabbix-portal-docker
docker load < /tmp/portal-images.tar.gz
docker compose up -d
```

## Comandos úteis
```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose restart backend
docker compose down
docker compose up -d --build  # rebuild após mudanças
```

## Backup do banco
```bash
docker run --rm -v zabbix-portal_portal-db:/data -v $(pwd):/backup alpine tar czf /backup/db-backup.tar.gz /data
```
