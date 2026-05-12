# Etapa de construcción
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Etapa de producción
FROM node:20-alpine AS production

WORKDIR /usr/src/app

COPY package*.json ./
#solo las dependencias de producción
RUN npm ci --only=production

COPY --from=builder /usr/src/app/dist ./dist

# Puerto en el que corre bh-core (puede variar según configuración)
EXPOSE 3000

CMD ["node", "dist/main"]
