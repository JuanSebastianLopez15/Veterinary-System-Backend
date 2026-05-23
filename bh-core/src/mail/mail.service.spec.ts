/// <reference types="jest" />
import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from './mail.service';
import { MailerService } from '@nestjs-modules/mailer';

const mailerServiceMock = {
  sendMail: jest.fn<Promise<void>, []>(),
};

describe('MailService', () => {
  let service: MailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: MailerService, useValue: mailerServiceMock },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
    jest.clearAllMocks();
  });

  //sendVerificationCode

  describe('sendVerificationCode', () => {
    it('debe llamar a mailerService.sendMail con los datos correctos', async () => {
      (mailerServiceMock.sendMail as jest.Mock).mockResolvedValueOnce(undefined);

      await service.sendVerificationCode({
        nombre: 'Juan Pérez',
        correo: 'juan@example.com',
        codigo: '482910',
      });

      expect(mailerServiceMock.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'juan@example.com',
          subject: expect.stringContaining('Verifica tu cuenta'),
          html: expect.stringContaining('482910'),
        }),
      );
    });

    it('NO debe lanzar excepción si mailerService falla', async () => {
      (mailerServiceMock.sendMail as jest.Mock).mockRejectedValueOnce(new Error('SMTP timeout'));

      await expect(
        service.sendVerificationCode({
          nombre: 'Ana López',
          correo: 'ana@example.com',
          codigo: '123456',
        }),
      ).resolves.not.toThrow();
    });
  });

  // sendAppointmentConfirmation

  describe('sendAppointmentConfirmation', () => {
    it('debe llamar a mailerService.sendMail con los datos de la cita', async () => {
      (mailerServiceMock.sendMail as jest.Mock).mockResolvedValueOnce(undefined);

      await service.sendAppointmentConfirmation({
        correo: 'cliente@example.com',
        nombreCliente: 'María Gómez',
        nombreMascota: 'Firulais',
        fechaCita: 'martes, 20 de mayo de 2025',
        horaCita: '10:30 AM',
        nombreVeterinario: 'Dr. Carlos Ruiz',
        direccionSede: 'Calle 50 #30-10, Manizales',
      });

      expect(mailerServiceMock.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'cliente@example.com',
          subject: expect.stringContaining('Firulais'),
          html: expect.stringContaining('Dr. Carlos Ruiz'),
        }),
      );
    });

    it('NO debe lanzar excepción si mailerService falla', async () => {
      (mailerServiceMock.sendMail as jest.Mock).mockRejectedValueOnce(new Error('Connection refused'));

      await expect(
        service.sendAppointmentConfirmation({
          correo: 'cliente@example.com',
          nombreCliente: 'Pedro',
          nombreMascota: 'Luna',
          fechaCita: 'lunes, 19 de mayo de 2025',
          horaCita: '3:00 PM',
          nombreVeterinario: 'Dra. Laura Díaz',
          direccionSede: 'Carrera 23 #15-40, Bogotá',
        }),
      ).resolves.not.toThrow();
    });
  });
});