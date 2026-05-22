import { Module } from '@nestjs/common';
import { MailService } from './mail.service';

/**
 * Modulo de correo electronico.
 * Exporta MailService para ser usado por otros modulos que necesiten enviar correos.
 */
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
