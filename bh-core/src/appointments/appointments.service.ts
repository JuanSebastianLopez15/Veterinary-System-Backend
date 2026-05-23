import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';

type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia' | 'otro';

export interface CreateAppointmentRequest {
  usuarioCodigo?: string;
  mascotaCodigo?: string;
  clienteCodigo?: string;
  fecha?: string;
  hora?: string;
  serviciosCodigos?: string[];
  metodoPago?: string;
}

export interface CreateClientAppointmentRequest {
  usuarioCodigo?: string;
  mascotaCodigo?: string;
  fecha?: string;
  hora?: string;
  serviciosCodigos?: string[];
  metodoPago?: string;
}

export interface AppointmentServiceResponse {
  codigo: string;
  nombre: string;
  precioUnitario: number;
}

export interface AppointmentPaymentResponse {
  codigo: string;
  monto: number;
  metodoPago: MetodoPago;
  fecha: string;
}

export interface CreatedAppointmentResponse {
  codigo: string;
  total: number;
  estado: string;
  servicios: AppointmentServiceResponse[];
  pago: AppointmentPaymentResponse;
}

export interface DailyAgendaAppointmentResponse {
  cita: {
    codigo: string;
    fecha: string;
    hora: string;
  };
  estado: string;
  total: number;
  mascota: {
    codigo: string;
    nombre: string;
    especie: string;
    raza: string;
  };
  cliente: {
    codigo: string;
    usuarioCodigo: string;
    nombre: string;
    apellido: string;
    correo: string;
    ciudad: string;
  };
  servicios: AppointmentServiceResponse[];
}

export interface CompletedAppointmentResponse {
  codigo: string;
  usuarioCodigo: string;
  mascotaCodigo: string;
  clienteCodigo: string;
  fecha: string;
  hora: string;
  estado: string;
  total: number;
}

interface ValidatedAppointmentRequest {
  usuarioCodigo: string;
  mascotaCodigo: string;
  clienteCodigo: string;
  fecha: string;
  hora: string;
  serviciosCodigos: string[];
  metodoPago: MetodoPago;
}

interface ValidatedClientAppointmentRequest {
  authenticatedUserCode: string;
  usuarioCodigo: string;
  mascotaCodigo: string;
  clienteCodigo: string;
  fecha: string;
  hora: string;
  serviciosCodigos: string[];
  metodoPago: MetodoPago;
}

const VALID_PAYMENT_METHODS: MetodoPago[] = [
  'efectivo',
  'tarjeta',
  'transferencia',
  'otro',
];

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private parseTime(timeStr: string): Date {
    return new Date(`1970-01-01T${timeStr}Z`);
  }

  async createConfirmedAppointment(
    body: CreateAppointmentRequest,
  ): Promise<CreatedAppointmentResponse> {
    const request = this.validateCreateAppointmentRequest(body);
    let createdAppointment: CreatedAppointmentResponse;

    await this.prisma.$transaction(async (tx) => {
      const available = await this.isAvailableWithRunner(
        tx,
        request.usuarioCodigo,
        request.fecha,
        request.hora,
      );

      if (!available) {
        throw new ConflictException(
          'No hay disponibilidad para el veterinario en la fecha y hora indicadas',
        );
      }

      const services = await this.findActiveServices(tx, request.serviciosCodigos);
      const total = Number(
        services
          .reduce((sum, service) => sum + service.precioUnitario, 0)
          .toFixed(2),
      );

      const appointment = await tx.cita.create({
        data: {
          usuario_codigo: request.usuarioCodigo,
          mascota_codigo: request.mascotaCodigo,
          cliente_codigo: request.clienteCodigo,
          fecha: new Date(request.fecha),
          hora: this.parseTime(request.hora),
          estado: 'confirmada',
          total,
          cita_servicios: {
            create: services.map((s) => ({
              servicio_codigo: s.codigo,
              nombre: s.nombre,
              precio_unitario: s.precioUnitario,
            })),
          },
          pago: {
            create: {
              monto: total,
              metodo_pago: request.metodoPago,
              fecha: new Date(),
            },
          },
        },
        include: {
          pago: true,
        },
      });

      createdAppointment = {
        codigo: appointment.codigo,
        total,
        estado: appointment.estado,
        servicios: services,
        pago: {
          codigo: appointment.pago!.codigo,
          monto: total,
          metodoPago: appointment.pago!.metodo_pago as MetodoPago,
          fecha: appointment.pago!.fecha.toISOString().split('T')[0],
        },
      };
    });

    this.auditService.emit({
      action: 'CREACION_CITA',
      userId: request.usuarioCodigo,
      userRole: 'veterinario',
      entityType: 'Appointment',
      entityId: createdAppointment!.codigo,
      details: {
        cita: {
          codigo: createdAppointment!.codigo,
          usuarioCodigo: request.usuarioCodigo,
          mascotaCodigo: request.mascotaCodigo,
          clienteCodigo: request.clienteCodigo,
          fecha: request.fecha,
          hora: request.hora,
          estado: createdAppointment!.estado,
          total: createdAppointment!.total,
          servicios: createdAppointment!.servicios,
        },
      },
    });



    this.auditService.emit({
      action: 'PAGO_CITA_REGISTRADO',
      userId: null,
      userRole: null,
      entityType: 'Payment',
      entityId: createdAppointment!.pago.codigo,
      details: {
        citaCodigo: createdAppointment!.codigo,
        pago: createdAppointment!.pago,
      },
    });

    return createdAppointment!;
  }

  async isAvailable(
    usuarioCodigo: string,
    fecha: string,
    hora: string,
  ): Promise<boolean> {
    return this.isAvailableWithRunner(this.prisma, usuarioCodigo, fecha, hora);
  }

  async findDailyAgenda(
    veterinarioCodigo: string,
    fecha: string,
  ): Promise<DailyAgendaAppointmentResponse[]> {
    const citas = await this.prisma.cita.findMany({
      where: {
        usuario_codigo: veterinarioCodigo,
        fecha: new Date(fecha),
      },
      include: {
        mascota: true,
        cliente: {
          include: {
            usuario: true,
          },
        },
        cita_servicios: {
          orderBy: { nombre: 'asc' },
        },
      },
      orderBy: {
        hora: 'asc',
      },
    });

    return citas.map((c) => {
      const horaStr = c.hora.toISOString().split('T')[1].substring(0, 8);
      const fechaStr = c.fecha.toISOString().split('T')[0];

      return {
        cita: {
          codigo: c.codigo,
          fecha: fechaStr,
          hora: horaStr,
        },
        estado: c.estado,
        total: Number(c.total),
        mascota: {
          codigo: c.mascota.codigo,
          nombre: c.mascota.nombre,
          especie: c.mascota.especie,
          raza: c.mascota.raza,
        },
        cliente: {
          codigo: c.cliente.codigo,
          usuarioCodigo: c.cliente.usuario_codigo,
          nombre: c.cliente.usuario.nombre,
          apellido: c.cliente.usuario.apellido,
          correo: c.cliente.usuario.correo,
          ciudad: c.cliente.ciudad,
        },
        servicios: c.cita_servicios.map((s) => ({
          codigo: s.servicio_codigo,
          nombre: s.nombre,
          precioUnitario: Number(s.precio_unitario),
        })),
      };
    });
  }

  async createClientAppointmentFromAccount(
    authenticatedUserCode: string | undefined,
    body: CreateClientAppointmentRequest,
  ): Promise<CreatedAppointmentResponse> {
    const request = await this.validateClientAppointmentRequest(
      authenticatedUserCode,
      body,
    );

    return this.createConfirmedAppointment({
      usuarioCodigo: request.usuarioCodigo,
      mascotaCodigo: request.mascotaCodigo,
      clienteCodigo: request.clienteCodigo,
      fecha: request.fecha,
      hora: request.hora,
      serviciosCodigos: request.serviciosCodigos,
      metodoPago: request.metodoPago,
    });
  }

  async completeAppointment(
    codigo: string,
    authenticatedUserCode: string | undefined,
  ): Promise<CompletedAppointmentResponse> {
    const appointmentCode = this.requiredString(codigo, 'codigo');
    const userCode = this.requiredString(authenticatedUserCode, 'x-user-code');

    const appointment = await this.prisma.cita.findUnique({
      where: { codigo: appointmentCode },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    if (appointment.usuario_codigo !== userCode) {
      throw new ForbiddenException(
        'Solo el veterinario asignado puede finalizar la cita',
      );
    }

    if (appointment.estado === 'cancelada' || appointment.estado === 'completada') {
      throw new ConflictException(
        'No se puede finalizar una cita cancelada o completada',
      );
    }

    const updated = await this.prisma.cita.update({
      where: { codigo: appointmentCode },
      data: { estado: 'completada' },
    });

    this.auditService.emit({
      action: 'CANCELACION_CITA',
      userId: userCode,
      userRole: 'veterinario',
      entityType: 'Appointment',
      entityId: appointmentCode,
      details: {
        estadoAnterior: appointment.estado,
        estadoNuevo: 'cancelada',
      },
    });

    const completedAppointment: CompletedAppointmentResponse = {
      codigo: updated.codigo,
      usuarioCodigo: updated.usuario_codigo,
      mascotaCodigo: updated.mascota_codigo,
      clienteCodigo: updated.cliente_codigo,
      fecha: updated.fecha.toISOString().split('T')[0],
      hora: updated.hora.toISOString().split('T')[1].substring(0, 8),
      estado: updated.estado,
      total: Number(updated.total),
    };

    this.auditService.emit({
      action: 'FINALIZACION_CITA',
      userId: userCode,
      userRole: 'veterinario',
      entityType: 'Appointment',
      entityId: completedAppointment.codigo,
      details: {
        estadoAnterior: appointment.estado,
        estadoNuevo: completedAppointment.estado,
        cita: completedAppointment,
      },
    });

    return completedAppointment;
  }

  async validateClientAppointmentRequest(
    authenticatedUserCode: string | undefined,
    body: CreateClientAppointmentRequest,
  ): Promise<ValidatedClientAppointmentRequest> {
    const userCode = this.requiredString(authenticatedUserCode, 'x-user-code');

    if (body && Object.prototype.hasOwnProperty.call(body, 'clienteCodigo')) {
      throw new BadRequestException(
        'clienteCodigo no debe enviarse en el cuerpo de la solicitud',
      );
    }

    const usuarioCodigo = this.requiredString(body?.usuarioCodigo, 'usuarioCodigo');
    const mascotaCodigo = this.requiredString(body?.mascotaCodigo, 'mascotaCodigo');
    const fecha = this.requiredString(body?.fecha, 'fecha');
    const hora = this.requiredString(body?.hora, 'hora');
    const metodoPago = this.requiredString(body?.metodoPago, 'metodoPago');

    if (!Array.isArray(body?.serviciosCodigos) || body.serviciosCodigos.length === 0) {
      throw new BadRequestException('serviciosCodigos debe ser un arreglo no vacío');
    }

    const serviciosCodigos = body.serviciosCodigos.map((codigo, index) => {
      if (typeof codigo !== 'string' || codigo.trim().length === 0) {
        throw new BadRequestException(
          `serviciosCodigos[${index}] debe ser un código válido`,
        );
      }

      return codigo.trim();
    });

    if (!VALID_PAYMENT_METHODS.includes(metodoPago as MetodoPago)) {
      throw new BadRequestException(
        'metodoPago debe ser efectivo, tarjeta, transferencia u otro',
      );
    }

    const clienteCodigo = await this.findClientCodeByUserCode(userCode);
    await this.ensurePetBelongsToClient(mascotaCodigo, clienteCodigo);

    return {
      authenticatedUserCode: userCode,
      usuarioCodigo,
      mascotaCodigo,
      clienteCodigo,
      fecha,
      hora,
      serviciosCodigos,
      metodoPago: metodoPago as MetodoPago,
    };
  }

  private async findClientCodeByUserCode(userCode: string): Promise<string> {
    const cliente = await this.prisma.cliente.findUnique({
      where: { usuario_codigo: userCode },
      select: { codigo: true },
    });

    if (!cliente) {
      throw new ForbiddenException(
        'No existe un cliente asociado al usuario autenticado',
      );
    }

    return cliente.codigo;
  }

  private async ensurePetBelongsToClient(
    mascotaCodigo: string,
    clienteCodigo: string,
  ): Promise<void> {
    const mascota = await this.prisma.mascotas.findFirst({
      where: {
        codigo: mascotaCodigo,
        cliente_codigo: clienteCodigo,
      },
    });

    if (!mascota) {
      throw new ForbiddenException(
        'La mascota indicada no pertenece al cliente autenticado',
      );
    }
  }

  private async isAvailableWithRunner(
    runner: any,
    usuarioCodigo: string,
    fecha: string,
    hora: string,
  ): Promise<boolean> {
    const cita = await runner.cita.findFirst({
      where: {
        usuario_codigo: usuarioCodigo,
        fecha: new Date(fecha),
        hora: this.parseTime(hora),
        estado: { not: 'cancelada' },
      },
    });

    return !cita;
  }

  private validateCreateAppointmentRequest(
    body: CreateAppointmentRequest,
  ): ValidatedAppointmentRequest {
    const usuarioCodigo = this.requiredString(body?.usuarioCodigo, 'usuarioCodigo');
    const mascotaCodigo = this.requiredString(body?.mascotaCodigo, 'mascotaCodigo');
    const clienteCodigo = this.requiredString(body?.clienteCodigo, 'clienteCodigo');
    const fecha = this.requiredString(body?.fecha, 'fecha');
    const hora = this.requiredString(body?.hora, 'hora');
    const metodoPago = this.requiredString(body?.metodoPago, 'metodoPago');

    if (!Array.isArray(body?.serviciosCodigos) || body.serviciosCodigos.length === 0) {
      throw new BadRequestException('serviciosCodigos debe ser un arreglo no vacío');
    }

    const serviciosCodigos = body.serviciosCodigos.map((codigo, index) => {
      if (typeof codigo !== 'string' || codigo.trim().length === 0) {
        throw new BadRequestException(
          `serviciosCodigos[${index}] debe ser un código válido`,
        );
      }

      return codigo.trim();
    });

    if (!VALID_PAYMENT_METHODS.includes(metodoPago as MetodoPago)) {
      throw new BadRequestException(
        'metodoPago debe ser efectivo, tarjeta, transferencia u otro',
      );
    }

    return {
      usuarioCodigo,
      mascotaCodigo,
      clienteCodigo,
      fecha,
      hora,
      serviciosCodigos,
      metodoPago: metodoPago as MetodoPago,
    };
  }

  private requiredString(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException(`${field} es obligatorio`);
    }

    return value.trim();
  }

  private async findActiveServices(
    runner: any,
    serviceCodes: string[],
  ): Promise<AppointmentServiceResponse[]> {
    const uniqueServiceCodes = [...new Set(serviceCodes)];
    
    const services = await runner.servicio.findMany({
      where: {
        codigo: { in: uniqueServiceCodes },
        estado: 'activo',
      },
    });

    const servicesByCode = new Map(services.map((s: any) => [s.codigo, s]));

    const invalidServiceCode = uniqueServiceCodes.find(
      (code) => !servicesByCode.has(code),
    );

    if (invalidServiceCode) {
      throw new BadRequestException('Todos los servicios deben existir y estar activos');
    }

    return serviceCodes.map((serviceCode) => {
      const service = servicesByCode.get(serviceCode) as any;

      return {
        codigo: service.codigo,
        nombre: service.nombre,
        precioUnitario: Number(service.precio),
      };
    });
  }
}
