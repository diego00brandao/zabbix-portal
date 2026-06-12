# Build stage
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build -- --base=/portal/

# Serve stage
FROM nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html/portal
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
