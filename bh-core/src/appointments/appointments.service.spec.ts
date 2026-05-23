import { AppointmentsService } from './appointments.service';

describe('AppointmentsService', () => {
  const prisma = {
    cita: {
      findMany: jest.fn(),
    },
  };

  const auditService = {
    emit: jest.fn(),
  };

  let service: AppointmentsService;

  beforeEach(() => {
    prisma.cita.findMany.mockReset();
    auditService.emit.mockReset();
    service = new AppointmentsService(prisma as any, auditService as any);
  });

  it('finds daily agenda appointments by veterinarian and date', async () => {
    const mockCitas = [
      {
        codigo: 'cit-01',
        fecha: new Date('2024-06-10T00:00:00Z'),
        hora: new Date('1970-01-01T09:00:00Z'),
        estado: 'confirmada',
        total: '85000.00',
        mascota: {
          codigo: 'msc-01',
          nombre: 'Rocky',
          especie: 'Perro',
          raza: 'Labrador Retriever',
        },
        cliente: {
          codigo: 'cli-01',
          usuario_codigo: 'usr-cli-01',
          ciudad: 'Manizales',
          usuario: {
            nombre: 'Carlos',
            apellido: 'Martinez',
            correo: 'carlos.martinez@gmail.com',
          },
        },
        cita_servicios: [
          {
            servicio_codigo: 'srv-01',
            nombre: 'Consulta General',
            precio_unitario: '50000',
          },
          {
            servicio_codigo: 'srv-02',
            nombre: 'Vacunacion',
            precio_unitario: '35000',
          },
        ],
      },
    ];

    prisma.cita.findMany.mockResolvedValue(mockCitas);

    const result = await service.findDailyAgenda('usr-vet-01', '2024-06-10');

    expect(result).toEqual([
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
    ]);

    expect(prisma.cita.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          usuario_codigo: 'usr-vet-01',
          fecha: new Date('2024-06-10'),
        },
      }),
    );
  });
});
