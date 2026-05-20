import { AppointmentsService } from './appointments.service';

describe('AppointmentsService', () => {
  const pool = {
    query: jest.fn(),
  };

  let service: AppointmentsService;

  beforeEach(() => {
    pool.query.mockReset();
    service = new AppointmentsService(pool as any, {} as any);
  });

  it('finds daily agenda appointments by veterinarian and date', async () => {
    pool.query.mockResolvedValue({
      rows: [
        {
          codigo: 'cit-01',
          fecha: '2024-06-10',
          hora: '09:00:00',
          estado: 'confirmada',
          total: '85000.00',
          mascotaCodigo: 'msc-01',
          mascotaNombre: 'Rocky',
          mascotaEspecie: 'Perro',
          mascotaRaza: 'Labrador Retriever',
          clienteCodigo: 'cli-01',
          clienteUsuarioCodigo: 'usr-cli-01',
          clienteNombre: 'Carlos',
          clienteApellido: 'Martinez',
          clienteCorreo: 'carlos.martinez@gmail.com',
          clienteCiudad: 'Manizales',
          servicios: [
            {
              codigo: 'srv-01',
              nombre: 'Consulta General',
              precioUnitario: '50000',
            },
            {
              codigo: 'srv-02',
              nombre: 'Vacunacion',
              precioUnitario: '35000',
            },
          ],
        },
      ],
    });

    await expect(
      service.findDailyAgenda('usr-vet-01', '2024-06-10'),
    ).resolves.toEqual([
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

    const [query, values] = pool.query.mock.calls[0];
    expect(query).toContain('WHERE c.usuario_codigo = $1');
    expect(query).toContain('AND c.fecha = $2::date');
    expect(values).toEqual(['usr-vet-01', '2024-06-10']);
  });
});
