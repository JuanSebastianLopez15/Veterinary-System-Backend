# Etapa de construcción
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate
RUN npm run build

# Etapa de producción
FROM node:22-alpine AS production

WORKDIR /usr/src/app

COPY package*.json ./
#solo las dependencias de producción
RUN npm install --omit=dev

COPY --from=builder /usr/src/app/dist ./dist

# Copiar archivos de Prisma necesarios para migraciones en runtime
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /usr/src/app/node_modules/@prisma ./node_modules/@prisma

# Copiar migraciones SQL (node-pg-migrate)
COPY --from=builder /usr/src/app/resources ./resources
COPY --from=builder /usr/src/app/database.json ./database.json

# Puerto en el que corre bh-core
EXPOSE 3000

# Ejecutar migraciones SQL y luego arrancar la app
CMD ["sh", "-c", "npx node-pg-migrate up --migrations-dir resources/database && node dist/main"]
