import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';

/**
 * Modulo de gestion de usuarios.
 * Importa DatabaseModule para acceso a BD y AuditModule para trazabilidad.
 */
@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
