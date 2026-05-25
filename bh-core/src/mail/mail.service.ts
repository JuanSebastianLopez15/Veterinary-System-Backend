import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * Servicio de correo electronico.
 * Gestiona el envio de correos usando nodemailer con SMTP de Gmail.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly driver: string;
  private readonly transporter?: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.driver = (this.configService.get<string>('MAIL_DRIVER') ?? 'gmail').toLowerCase();

    if (this.driver === 'console') {
      this.logger.log('MAIL_DRIVER=console activo; los codigos se imprimen en consola.');
      return;
    }

    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.configService.get<string>('MAIL_USER'),
        pass: this.configService.get<string>('MAIL_PASS'),
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  /**
   * Envia el codigo de verificacion al correo del usuario recien registrado.
   *
   * @param correo - Direccion de correo destino
   * @param codigo - Codigo de verificacion de 6 digitos
   */
  async sendVerificationCode(correo: string, codigo: string): Promise<void> {
    if (this.driver === 'console') {
      this.logger.log(`[DEV EMAIL] Codigo de verificacion para ${correo}: ${codigo}`);
      return;
    }

    if (!this.transporter) {
      throw new Error('Transportador de correo no configurado');
    }

    await this.transporter.sendMail({
      from: `"Breaze & Harold" <${this.configService.get<string>('MAIL_FROM')}>`,
      to: correo,
      subject: 'Codigo de verificacion - Breaze & Harold',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; background-color: #f9f9f9; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">

          <!-- Header -->
          <div style="background: linear-gradient(135deg, #2d6a4f, #52b788); padding: 32px 24px; text-align: center;">
            <div style="font-size: 40px;">🐾</div>
            <h1 style="color: #ffffff; margin: 8px 0 4px; font-size: 26px; letter-spacing: 1px;">Breaze &amp; Harold</h1>
            <p style="color: #d8f3dc; margin: 0; font-size: 14px;">Clinica Veterinaria</p>
          </div>

          <!-- Body -->
          <div style="background-color: #ffffff; padding: 32px 24px;">
            <h2 style="color: #1b4332; margin-top: 0;">¡Bienvenido a nuestra familia! 🐶🐱</h2>
            <p style="color: #555; font-size: 15px; line-height: 1.6;">
              Gracias por registrarte en <strong>Breaze &amp; Harold</strong>. Estamos felices de tenerte con nosotros.
              Para activar tu cuenta, ingresa el siguiente codigo de verificacion:
            </p>

            <!-- Codigo -->
            <div style="background: linear-gradient(135deg, #d8f3dc, #b7e4c7); border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
              <p style="color: #2d6a4f; font-size: 13px; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 2px;">Tu codigo de verificacion</p>
              <div style="font-size: 42px; font-weight: bold; letter-spacing: 12px; color: #1b4332;">
                ${codigo}
              </div>
            </div>

            <p style="color: #888; font-size: 13px; text-align: center;">
              ⏱ Este codigo expira en <strong>15 minutos</strong>.
            </p>

            <hr style="border: none; border-top: 1px solid #e8e8e8; margin: 24px 0;">

            <p style="color: #aaa; font-size: 12px; text-align: center;">
              Si no creaste esta cuenta, puedes ignorar este correo sin problema.<br>
              Nadie mas tiene acceso a tu informacion.
            </p>
          </div>

          <!-- Footer -->
          <div style="background-color: #1b4332; padding: 16px 24px; text-align: center;">
            <p style="color: #74c69d; font-size: 12px; margin: 0;">
              🐾 Breaze &amp; Harold — Cuidamos a tu mejor amigo con amor
            </p>
          </div>

        </div>
      `,
    });
  }

  /**
   * Envia la confirmacion de cita al correo del cliente.
   * Se llama automaticamente cuando se registra exitosamente el pago de una cita.
   *
   * @param correo - Direccion de correo del cliente
   * @param datos - Informacion de la cita: cliente, mascota, veterinario, fecha, hora, servicios y total
   */
  async sendAppointmentConfirmation(
    correo: string,
    datos: {
      nombreCliente: string;
      nombreMascota: string;
      nombreVeterinario: string;
      fecha: string;
      hora: string;
      servicios: { nombre: string; precioUnitario: number }[];
      total: number;
    },
  ): Promise<void> {
    if (this.driver === 'console') {
      this.logger.log(
        `[DEV EMAIL] Confirmacion de cita para ${correo}: ${datos.nombreCliente} - ${datos.fecha} ${datos.hora}`,
      );
      return;
    }

    if (!this.transporter) {
      throw new Error('Transportador de correo no configurado');
    }

    const serviciosHtml = datos.servicios
      .map(
        (s) => `
        <tr>
          <td style="padding: 10px 12px; color: #555; font-size: 14px; border-bottom: 1px solid #f0f0f0;">${s.nombre}</td>
          <td style="padding: 10px 12px; color: #2d6a4f; font-size: 14px; text-align: right; border-bottom: 1px solid #f0f0f0; font-weight: bold;">
            $${s.precioUnitario.toLocaleString('es-CO')}
          </td>
        </tr>`,
      )
      .join('');

    await this.transporter.sendMail({
      from: `"Breaze & Harold" <${this.configService.get<string>('MAIL_FROM')}>`,
      to: correo,
      subject: 'Confirmacion de cita - Breaze & Harold',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto; background-color: #f9f9f9; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">

          <!-- Header -->
          <div style="background: linear-gradient(135deg, #2d6a4f, #52b788); padding: 32px 24px; text-align: center;">
            <div style="font-size: 40px;">🐾</div>
            <h1 style="color: #ffffff; margin: 8px 0 4px; font-size: 26px; letter-spacing: 1px;">Breaze &amp; Harold</h1>
            <p style="color: #d8f3dc; margin: 0; font-size: 14px;">Clinica Veterinaria</p>
          </div>

          <!-- Body -->
          <div style="background-color: #ffffff; padding: 32px 24px;">
            <h2 style="color: #1b4332; margin-top: 0;">Cita confirmada ✅</h2>
            <p style="color: #555; font-size: 15px; line-height: 1.6;">
              Hola <strong>${datos.nombreCliente}</strong>, tu cita ha sido registrada exitosamente.
              A continuacion encontraras el resumen:
            </p>

            <!-- Detalles de la cita -->
            <div style="background: linear-gradient(135deg, #d8f3dc, #b7e4c7); border-radius: 12px; padding: 20px 24px; margin: 24px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; color: #2d6a4f; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; width: 40%;">Mascota</td>
                  <td style="padding: 6px 0; color: #1b4332; font-size: 14px; font-weight: bold;">${datos.nombreMascota}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #2d6a4f; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Veterinario</td>
                  <td style="padding: 6px 0; color: #1b4332; font-size: 14px; font-weight: bold;">${datos.nombreVeterinario}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #2d6a4f; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Fecha</td>
                  <td style="padding: 6px 0; color: #1b4332; font-size: 14px; font-weight: bold;">${datos.fecha}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #2d6a4f; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Hora</td>
                  <td style="padding: 6px 0; color: #1b4332; font-size: 14px; font-weight: bold;">${datos.hora}</td>
                </tr>
              </table>
            </div>

            <!-- Servicios -->
            <p style="color: #1b4332; font-size: 14px; font-weight: bold; margin-bottom: 8px;">Servicios incluidos:</p>
            <table style="width: 100%; border-collapse: collapse; border-radius: 8px; overflow: hidden; border: 1px solid #e8e8e8;">
              ${serviciosHtml}
              <tr style="background-color: #f4faf6;">
                <td style="padding: 12px; color: #1b4332; font-size: 14px; font-weight: bold;">Total pagado</td>
                <td style="padding: 12px; color: #2d6a4f; font-size: 16px; font-weight: bold; text-align: right;">
                  $${datos.total.toLocaleString('es-CO')}
                </td>
              </tr>
            </table>

            <hr style="border: none; border-top: 1px solid #e8e8e8; margin: 24px 0;">

            <p style="color: #aaa; font-size: 12px; text-align: center;">
              Si tienes alguna pregunta, comunicate con nosotros.<br>
              Te esperamos con los brazos abiertos y con mucho amor para tu mascota 🐶🐱
            </p>
          </div>

          <!-- Footer -->
          <div style="background-color: #1b4332; padding: 16px 24px; text-align: center;">
            <p style="color: #74c69d; font-size: 12px; margin: 0;">
              🐾 Breaze &amp; Harold — Cuidamos a tu mejor amigo con amor
            </p>
          </div>

        </div>
      `,
    });
  }
}
