import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';

/**
 * Modulo de gestion de usuarios.
 * Importa DatabaseModule para acceso a BD, AuditModule para trazabilidad
 * y AuthModule para los guards de autenticacion y roles.
 */
@Module({
  imports: [DatabaseModule, AuditModule, AuthModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
