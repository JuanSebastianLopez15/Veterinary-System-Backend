import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { VerificationMailDto, AppointmentConfirmationMailDto } from './dto/mail.dto';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly mailerService: MailerService) {}

  async sendVerificationCode(dto: VerificationMailDto): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: dto.correo,
        subject: 'Verifica tu cuenta — Breaze & Harold Veterinary',
        html: `
          <p>Hola, <strong>${dto.nombre}</strong>.</p>
          <p>Tu código de verificación es:</p>
          <h2>${dto.codigo}</h2>
          <p>Este código es válido por 24 horas.</p>
          <p>Si no solicitaste esta cuenta, ignora este correo.</p>
        `,
      });
      this.logger.log(`Correo de verificación enviado a ${dto.correo}`);
    } catch (error) {
      this.logger.error(
        `Error al enviar correo de verificación a ${dto.correo}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async sendAppointmentConfirmation(dto: AppointmentConfirmationMailDto): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: dto.correo,
        subject: `Cita confirmada para ${dto.nombreMascota} — Breaze & Harold Veterinary`,
        html: `
          <p>Hola, <strong>${dto.nombreCliente}</strong>.</p>
          <p>Tu cita ha sido confirmada exitosamente. Aquí están los detalles:</p>
          <ul>
            <li><strong>Mascota:</strong> ${dto.nombreMascota}</li>
            <li><strong>Fecha:</strong> ${dto.fechaCita}</li>
            <li><strong>Hora:</strong> ${dto.horaCita}</li>
            <li><strong>Veterinario:</strong> ${dto.nombreVeterinario}</li>
            <li><strong>Dirección:</strong> ${dto.direccionSede}</li>
          </ul>
          <p>Recuerda llegar <strong>10 minutos antes</strong> de tu cita.</p>
        `,
      });
      this.logger.log(`Confirmación de cita enviada a ${dto.correo}`);
    } catch (error) {
      this.logger.error(
        `Error al enviar confirmación de cita a ${dto.correo}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}