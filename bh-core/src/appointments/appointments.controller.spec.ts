import { BadRequestException } from '@nestjs/common';

import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';

describe('AppointmentsController', () => {
  const appointmentsService = {
    findDailyAgenda: jest.fn(),
  };
  let controller: AppointmentsController;

  beforeEach(() => {
    appointmentsService.findDailyAgenda.mockReset();
    controller = new AppointmentsController(
      appointmentsService as unknown as AppointmentsService,
    );
  });

  it('returns the daily agenda filtered by veterinarian and date', async () => {
    const dailyAgenda = [
      {
        cita: {
          codigo: 'cit-01',
          fecha: '2024-06-10',
          hora: '09:00:00',
        },
        estado: 'confirmada',
        total: 85000,
        mascota: {
          codigo: 'msc-01',
          nombre: 'Rocky',
          especie: 'Perro',
          raza: 'Labrador Retriever',
        },
        cliente: {
          codigo: 'cli-01',
          usuarioCodigo: 'usr-cli-01',
          nombre: 'Carlos',
          apellido: 'Martinez',
          correo: 'carlos.martinez@gmail.com',
          ciudad: 'Manizales',
        },
        servicios: [
          {
            codigo: 'srv-01',
            nombre: 'Consulta General',
            precioUnitario: 50000,
          },
          {
            codigo: 'srv-02',
            nombre: 'Vacunacion',
            precioUnitario: 35000,
          },
        ],
      },
    ];
    appointmentsService.findDailyAgenda.mockResolvedValue(dailyAgenda);

    await expect(
      controller.findDailyAgenda('usr-vet-01', '2024-06-10'),
    ).resolves.toEqual(dailyAgenda);

    expect(appointmentsService.findDailyAgenda).toHaveBeenCalledWith(
      'usr-vet-01',
      '2024-06-10',
    );
  });

  it('requires veterinarian and date filters', async () => {
    await expect(
      controller.findDailyAgenda('usr-vet-01', undefined as unknown as string),
    ).rejects.toThrow(BadRequestException);

    expect(appointmentsService.findDailyAgenda).not.toHaveBeenCalled();
  });
});
