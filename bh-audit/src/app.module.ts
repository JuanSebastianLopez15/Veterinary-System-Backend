import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { HealthController } from './health.controller';

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
    PrismaModule,
    AuditModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}