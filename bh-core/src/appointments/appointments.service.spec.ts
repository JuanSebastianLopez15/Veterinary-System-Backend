import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';

import { AuditAction } from '../audit/enums/audit-action.enum';
import {
  AppointmentsService,
  AuthenticatedUser,
  CreateAppointmentRequest,
} from './appointments.service';

describe('AppointmentsService', () => {
  const recepcionista: AuthenticatedUser = {
    codigo: '11111111-1111-1111-1111-111111111111',
    rol: 'RECEPCIONISTA',
    ipAddress: '127.0.0.1',
  };
  const cliente: AuthenticatedUser = {
    codigo: '22222222-2222-2222-2222-222222222222',
    rol: 'CLIENTE',
    ipAddress: '127.0.0.1',
  };
  const veterinario: AuthenticatedUser = {
    codigo: '33333333-3333-3333-3333-333333333333',
    rol: 'VETERINARIO',
    ipAddress: '127.0.0.1',
  };

  const createRequest: CreateAppointmentRequest = {
    usuarioCodigo: veterinario.codigo,
    clienteCodigo: '44444444-4444-4444-4444-444444444444',
    mascotaCodigo: '55555555-5555-5555-5555-555555555555',
    fecha: '2024-06-10',
    hora: '09:00',
    serviciosCodigos: ['66666666-6666-6666-6666-666666666666'],
    metodoPago: 'tarjeta',
  };

  const appointmentDate = new Date('2024-06-10T00:00:00.000Z');
  const appointmentTime = new Date('1970-01-01T09:00:00.000Z');

  let prisma: any;
  let tx: any;
  let auditService: any;
  let mailService: any;
  let service: AppointmentsService;

  beforeEach(() => {
    tx = {
      usuario: {
        findUnique: jest.fn().mockResolvedValue({
          codigo: veterinario.codigo,
          rol: 'VETERINARIO',
          estado: 'activo',
        }),
      },
      cliente: {
        findUnique: jest.fn().mockResolvedValue({ codigo: createRequest.clienteCodigo }),
      },
      mascotas: {
        findFirst: jest.fn().mockResolvedValue({ codigo: createRequest.mascotaCodigo }),
      },
      cita: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          codigo: '77777777-7777-7777-7777-777777777777',
          estado: 'confirmada',
          pago: {
            codigo: '88888888-8888-8888-8888-888888888888',
            metodo_pago: 'tarjeta',
            fecha: new Date('2024-06-10T12:00:00.000Z'),
          },
        }),
      },
      servicio: {
        findMany: jest.fn().mockResolvedValue([
          {
            codigo: '66666666-6666-6666-6666-666666666666',
            nombre: 'Consulta General',
            precio: 50000,
          },
        ]),
      },
    };

    prisma = {
      $transaction: jest.fn((callback: any) => callback(tx)),
      usuario: {
        findUnique: jest.fn().mockResolvedValue({
          codigo: veterinario.codigo,
          rol: 'VETERINARIO',
          estado: 'activo',
          nombre: 'Ana',
          apellido: 'Vet',
        }),
      },
      cliente: {
        findUnique: jest.fn().mockResolvedValue({
          codigo: createRequest.clienteCodigo,
          usuario: {
            correo: 'cliente@correo.com',
            nombre: 'Carlos',
            apellido: 'Cliente',
          },
        }),
      },
      mascotas: {
        findUnique: jest.fn().mockResolvedValue({ nombre: 'Rocky' }),
        findFirst: jest.fn().mockResolvedValue({ codigo: createRequest.mascotaCodigo }),
      },
      cita: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      servicio: {
        findMany: jest.fn(),
      },
    };

    auditService = {
      emit: jest.fn().mockResolvedValue(undefined),
    };

    mailService = {
      sendAppointmentConfirmation: jest.fn().mockResolvedValue(undefined),
    };

    service = new AppointmentsService(
      prisma as any,
      auditService as any,
      mailService as any,
    );
  });

  it('creates an appointment with active services and an approved payment', async () => {
    const result = await service.createConfirmedAppointment(
      recepcionista,
      createRequest,
    );

    expect(result).toEqual({
      codigo: '77777777-7777-7777-7777-777777777777',
      total: 50000,
      estado: 'confirmada',
      servicios: [
        {
          codigo: '66666666-6666-6666-6666-666666666666',
          nombre: 'Consulta General',
          precioUnitario: 50000,
        },
      ],
      pago: {
        codigo: '88888888-8888-8888-8888-888888888888',
        monto: 50000,
        metodoPago: 'tarjeta',
        estado: 'aprobado',
        fecha: '2024-06-10',
      },
    });

    expect(tx.cita.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          estado: 'confirmada',
          pago: {
            create: expect.objectContaining({
              monto: 50000,
              metodo_pago: 'tarjeta',
            }),
          },
        }),
      }),
    );
    expect(auditService.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CREACION_CITA,
        userId: recepcionista.codigo,
        userRole: 'recepcionista',
        entityType: 'Appointment',
      }),
    );
    expect(auditService.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.PAGO_CITA_REGISTRADO,
        userId: recepcionista.codigo,
        userRole: 'recepcionista',
        entityType: 'Payment',
        details: expect.objectContaining({
          proveedor: 'mock',
          resultado: 'aprobado',
        }),
      }),
    );
  });

  it('rejects appointment creation without payment method', async () => {
    await expect(
      service.createConfirmedAppointment(recepcionista, {
        ...createRequest,
        metodoPago: undefined,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects appointment creation with an invalid payment method', async () => {
    await expect(
      service.createConfirmedAppointment(recepcionista, {
        ...createRequest,
        metodoPago: 'bitcoin',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a busy veterinarian at the requested date and time', async () => {
    tx.cita.findFirst.mockResolvedValue({ codigo: 'ocupada' });

    await expect(
      service.createConfirmedAppointment(recepcionista, createRequest),
    ).rejects.toThrow(ConflictException);

    expect(tx.cita.findFirst).toHaveBeenCalledWith({
      where: {
        usuario_codigo: veterinario.codigo,
        fecha: appointmentDate,
        hora: appointmentTime,
        estado: { not: 'cancelada' },
      },
    });
    expect(tx.cita.create).not.toHaveBeenCalled();
  });

  it('rejects inactive or missing services', async () => {
    tx.servicio.findMany.mockResolvedValue([]);

    await expect(
      service.createConfirmedAppointment(recepcionista, createRequest),
    ).rejects.toThrow(BadRequestException);

    expect(tx.cita.create).not.toHaveBeenCalled();
  });

  it('rejects a client scheduling a pet that does not belong to them', async () => {
    tx.mascotas.findFirst.mockResolvedValue(null);

    await expect(
      service.createClientAppointmentFromAccount(cliente, {
        usuarioCodigo: veterinario.codigo,
        mascotaCodigo: createRequest.mascotaCodigo,
        fecha: createRequest.fecha,
        hora: createRequest.hora,
        serviciosCodigos: createRequest.serviciosCodigos,
        metodoPago: createRequest.metodoPago,
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(tx.cita.create).not.toHaveBeenCalled();
  });

  it('returns the daily agenda only for authorized roles', async () => {
    prisma.cita.findMany.mockResolvedValue([
      {
        codigo: '77777777-7777-7777-7777-777777777777',
        fecha: appointmentDate,
        hora: appointmentTime,
        estado: 'confirmada',
        total: '50000.00',
        mascota: {
          codigo: createRequest.mascotaCodigo,
          nombre: 'Rocky',
          especie: 'Perro',
          raza: 'Labrador',
        },
        cliente: {
          codigo: createRequest.clienteCodigo,
          usuario_codigo: cliente.codigo,
          ciudad: 'Manizales',
          usuario: {
            nombre: 'Carlos',
            apellido: 'Cliente',
            correo: 'cliente@correo.com',
          },
        },
        cita_servicios: [
          {
            servicio_codigo: '66666666-6666-6666-6666-666666666666',
            nombre: 'Consulta General',
            precio_unitario: '50000',
          },
        ],
      },
    ]);

    await expect(
      service.findDailyAgenda(veterinario, veterinario.codigo, '2024-06-10'),
    ).resolves.toHaveLength(1);

    await expect(
      service.findDailyAgenda(
        { ...veterinario, codigo: '99999999-9999-9999-9999-999999999999' },
        veterinario.codigo,
        '2024-06-10',
      ),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      service.findDailyAgenda(cliente, veterinario.codigo, '2024-06-10'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows the assigned veterinarian to complete a confirmed appointment', async () => {
    prisma.cita.findUnique.mockResolvedValue({
      codigo: '77777777-7777-7777-7777-777777777777',
      usuario_codigo: veterinario.codigo,
      mascota_codigo: createRequest.mascotaCodigo,
      cliente_codigo: createRequest.clienteCodigo,
      fecha: appointmentDate,
      hora: appointmentTime,
      estado: 'confirmada',
      total: '50000.00',
      pago: { codigo: '88888888-8888-8888-8888-888888888888' },
    });
    prisma.cita.update.mockResolvedValue({
      codigo: '77777777-7777-7777-7777-777777777777',
      usuario_codigo: veterinario.codigo,
      mascota_codigo: createRequest.mascotaCodigo,
      cliente_codigo: createRequest.clienteCodigo,
      fecha: appointmentDate,
      hora: appointmentTime,
      estado: 'completada',
      total: '50000.00',
      motivo_cancelacion: null,
    });

    const result = await service.completeAppointment(
      '77777777-7777-7777-7777-777777777777',
      veterinario,
    );

    expect(result.estado).toBe('completada');
    expect(prisma.cita.update).toHaveBeenCalledWith({
      where: { codigo: '77777777-7777-7777-7777-777777777777' },
      data: { estado: 'completada' },
    });
    expect(auditService.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CAMBIO_ESTADO_CITA,
        userId: veterinario.codigo,
        userRole: 'veterinario',
      }),
    );
    expect(auditService.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.FINALIZACION_CITA,
      }),
    );
    expect(auditService.emit).not.toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CANCELACION_CITA,
      }),
    );
  });

  it('rejects a client completing an appointment', async () => {
    await expect(
      service.completeAppointment('77777777-7777-7777-7777-777777777777', cliente),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.cita.findUnique).not.toHaveBeenCalled();
  });

  it('rejects completing a canceled appointment', async () => {
    prisma.cita.findUnique.mockResolvedValue({
      codigo: '77777777-7777-7777-7777-777777777777',
      usuario_codigo: veterinario.codigo,
      estado: 'cancelada',
      pago: { codigo: '88888888-8888-8888-8888-888888888888' },
    });

    await expect(
      service.completeAppointment(
        '77777777-7777-7777-7777-777777777777',
        veterinario,
      ),
    ).rejects.toThrow(ConflictException);

    expect(prisma.cita.update).not.toHaveBeenCalled();
  });

  it('cancels an appointment with a reason', async () => {
    prisma.cita.findUnique.mockResolvedValue({
      codigo: '77777777-7777-7777-7777-777777777777',
      usuario_codigo: veterinario.codigo,
      mascota_codigo: createRequest.mascotaCodigo,
      cliente_codigo: createRequest.clienteCodigo,
      fecha: appointmentDate,
      hora: appointmentTime,
      estado: 'confirmada',
      total: '50000.00',
    });
    prisma.cita.update.mockResolvedValue({
      codigo: '77777777-7777-7777-7777-777777777777',
      usuario_codigo: veterinario.codigo,
      mascota_codigo: createRequest.mascotaCodigo,
      cliente_codigo: createRequest.clienteCodigo,
      fecha: appointmentDate,
      hora: appointmentTime,
      estado: 'cancelada',
      total: '50000.00',
      motivo_cancelacion: 'Cliente no puede asistir',
    });

    const result = await service.cancelAppointment(
      '77777777-7777-7777-7777-777777777777',
      recepcionista,
      { motivo: 'Cliente no puede asistir' },
    );

    expect(result).toEqual(
      expect.objectContaining({
        estado: 'cancelada',
        motivoCancelacion: 'Cliente no puede asistir',
      }),
    );
    expect(prisma.cita.update).toHaveBeenCalledWith({
      where: { codigo: '77777777-7777-7777-7777-777777777777' },
      data: {
        estado: 'cancelada',
        motivo_cancelacion: 'Cliente no puede asistir',
      },
    });
    expect(auditService.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CANCELACION_CITA,
        details: expect.objectContaining({
          motivoCancelacion: 'Cliente no puede asistir',
        }),
      }),
    );
  });

  it('does not break the main flow if bh-audit fails', async () => {
    auditService.emit.mockRejectedValue(new Error('audit down'));

    await expect(
      service.createConfirmedAppointment(recepcionista, createRequest),
    ).resolves.toEqual(
      expect.objectContaining({
        codigo: '77777777-7777-7777-7777-777777777777',
        estado: 'confirmada',
      }),
    );
  });
});
