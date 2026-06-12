FROM node:20-alpine

WORKDIR /app

# Install deps first for layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# App source
COPY . .

# Persist database and uploads via volumes
RUN mkdir -p /app/db /app/uploads/changelog

EXPOSE 3001

CMD ["node", "server.js"]
