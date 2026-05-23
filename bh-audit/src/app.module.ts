import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditModule } from './audit/audit.module';

/**
 * Módulo principal de la aplicación.
 */
@Module({
  imports: [
    /**
     * Carga variables de entorno desde .env
     */
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    /**
     * Configuración de conexión PostgreSQL.
     */
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      autoLoadEntities: true,
      synchronize: true,
    }),

    AuditModule,
  ],
})
export class AppModule {}