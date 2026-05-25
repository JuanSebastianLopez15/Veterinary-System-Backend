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
# solo las dependencias de producción
RUN npm install --omit=dev

COPY --from=builder /usr/src/app/dist ./dist

# Copiar archivos de Prisma necesarios para migraciones en runtime
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /usr/src/app/node_modules/@prisma ./node_modules/@prisma

# Puerto en el que corre bh-audit
EXPOSE 3001

# Ejecutar prisma db push para crear/actualizar tablas y luego arrancar la app
CMD ["sh", "-c", "npx prisma db push --skip-generate && node dist/main"]
