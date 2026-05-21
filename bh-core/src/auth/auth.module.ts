import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DatabaseModule } from '../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { MailModule } from '../mail/mail.module';

/**
 * Modulo de autenticacion.
 * Gestiona registro, verificacion de correo e inicio de sesion.
 * Importa DatabaseModule para acceso a BD, AuditModule para trazabilidad
 * y MailModule para envio de correos de verificacion.
 */
@Module({
  imports: [DatabaseModule, AuditModule, MailModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
