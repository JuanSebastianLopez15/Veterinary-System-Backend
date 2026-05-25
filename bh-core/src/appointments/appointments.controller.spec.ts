import { BadRequestException } from '@nestjs/common';

import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';

describe('AppointmentsController', () => {
  const appointmentsService = {
    createConfirmedAppointment: jest.fn(),
    createClientAppointmentFromAccount: jest.fn(),
    completeAppointment: jest.fn(),
    cancelAppointment: jest.fn(),
    isAvailable: jest.fn(),
    findDailyAgenda: jest.fn(),
  };
  let controller: AppointmentsController;

  const req = {
    ip: '127.0.0.1',
    user: {
      codigo: '33333333-3333-3333-3333-333333333333',
      rol: 'VETERINARIO',
    },
  };

  beforeEach(() => {
    Object.values(appointmentsService).forEach((mock) => mock.mockReset());
    controller = new AppointmentsController(
      appointmentsService as unknown as AppointmentsService,
    );
  });

  it('returns the daily agenda filtered by veterinarian and date using the authenticated actor', async () => {
    const dailyAgenda = [
      {
        cita: {
          codigo: '77777777-7777-7777-7777-777777777777',
          fecha: '2024-06-10',
          hora: '09:00:00',
        },
        estado: 'confirmada',
        total: 85000,
        mascota: {
          codigo: '55555555-5555-5555-5555-555555555555',
          nombre: 'Rocky',
          especie: 'Perro',
          raza: 'Labrador Retriever',
        },
        cliente: {
          codigo: '44444444-4444-4444-4444-444444444444',
          usuarioCodigo: '22222222-2222-2222-2222-222222222222',
          nombre: 'Carlos',
          apellido: 'Martinez',
          correo: 'carlos.martinez@gmail.com',
          ciudad: 'Manizales',
        },
        servicios: [
          {
            codigo: '66666666-6666-6666-6666-666666666666',
            nombre: 'Consulta General',
            precioUnitario: 50000,
          },
        ],
      },
    ];
    appointmentsService.findDailyAgenda.mockResolvedValue(dailyAgenda);

    await expect(
      controller.findDailyAgenda(
        req,
        '33333333-3333-3333-3333-333333333333',
        '2024-06-10',
      ),
    ).resolves.toEqual(dailyAgenda);

    expect(appointmentsService.findDailyAgenda).toHaveBeenCalledWith(
      {
        codigo: '33333333-3333-3333-3333-333333333333',
        rol: 'VETERINARIO',
        ipAddress: '127.0.0.1',
      },
      '33333333-3333-3333-3333-333333333333',
      '2024-06-10',
    );
  });

  it('requires veterinarian and date filters for daily agenda', async () => {
    await expect(
      controller.findDailyAgenda(
        req,
        '33333333-3333-3333-3333-333333333333',
        undefined as unknown as string,
      ),
    ).rejects.toThrow(BadRequestException);

    expect(appointmentsService.findDailyAgenda).not.toHaveBeenCalled();
  });

  it('delegates appointment cancellation with the authenticated actor', async () => {
    appointmentsService.cancelAppointment.mockResolvedValue({
      codigo: '77777777-7777-7777-7777-777777777777',
      estado: 'cancelada',
      motivoCancelacion: 'Cliente no puede asistir',
    });

    await controller.cancelAppointment(
      '77777777-7777-7777-7777-777777777777',
      req,
      { motivo: 'Cliente no puede asistir' },
    );

    expect(appointmentsService.cancelAppointment).toHaveBeenCalledWith(
      '77777777-7777-7777-7777-777777777777',
      {
        codigo: '33333333-3333-3333-3333-333333333333',
        rol: 'VETERINARIO',
        ipAddress: '127.0.0.1',
      },
      { motivo: 'Cliente no puede asistir' },
    );
  });
});
