import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AuditAction } from '../audit/enums/audit-action.enum';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../database/prisma.service';
import { MailService } from '../mail/mail.service';

type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia' | 'otro';
type PagoEstado = 'aprobado';
type RolAutenticado = 'CLIENTE' | 'RECEPCIONISTA' | 'VETERINARIO' | 'ADMIN';
type RolAuditoria = 'cliente' | 'recepcionista' | 'veterinario' | 'administrador';

export interface AuthenticatedUser {
  codigo: string;
  rol: string;
  ipAddress?: string;
}

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

export interface CancelAppointmentRequest {
  motivo?: string;
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
  estado: PagoEstado;
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

export interface AppointmentStateResponse {
  codigo: string;
  usuarioCodigo: string;
  mascotaCodigo: string;
  clienteCodigo: string;
  fecha: string;
  hora: string;
  estado: string;
  total: number;
  motivoCancelacion?: string | null;
}

export type CompletedAppointmentResponse = AppointmentStateResponse;

interface ValidatedAppointmentRequest {
  usuarioCodigo: string;
  mascotaCodigo: string;
  clienteCodigo: string;
  fecha: string;
  hora: string;
  serviciosCodigos: string[];
  metodoPago: MetodoPago;
}

interface AuditAppointmentEvent {
  action: AuditAction;
  entityType: 'Appointment' | 'Payment';
  entityId: string;
  details: Record<string, unknown>;
}

const VALID_PAYMENT_METHODS: MetodoPago[] = [
  'efectivo',
  'tarjeta',
  'transferencia',
  'otro',
];

const AUDIT_ROLE_BY_AUTH_ROLE: Record<RolAutenticado, RolAuditoria> = {
  CLIENTE: 'cliente',
  RECEPCIONISTA: 'recepcionista',
  VETERINARIO: 'veterinario',
  ADMIN: 'administrador',
};

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly mailService: MailService,
  ) {}

  private get db(): any {
    return this.prisma as any;
  }

  async createConfirmedAppointment(
    actor: AuthenticatedUser,
    body: CreateAppointmentRequest,
  ): Promise<CreatedAppointmentResponse> {
    this.ensureActorRole(actor, ['RECEPCIONISTA']);
    const request = this.validateCreateAppointmentRequest(body);

    return this.createConfirmedAppointmentForRequest(actor, request);
  }

  async createClientAppointmentFromAccount(
    actor: AuthenticatedUser,
    body: CreateClientAppointmentRequest,
  ): Promise<CreatedAppointmentResponse> {
    this.ensureActorRole(actor, ['CLIENTE']);

    if (body && Object.prototype.hasOwnProperty.call(body, 'clienteCodigo')) {
      throw new BadRequestException(
        'clienteCodigo no debe enviarse en el cuerpo de la solicitud',
      );
    }

    const usuarioCodigo = this.requiredString(body?.usuarioCodigo, 'usuarioCodigo');
    const mascotaCodigo = this.requiredString(body?.mascotaCodigo, 'mascotaCodigo');
    const fecha = this.normalizeDate(body?.fecha);
    const hora = this.normalizeTime(body?.hora);
    const serviciosCodigos = this.validateServiceCodes(body?.serviciosCodigos);
    const metodoPago = this.validatePaymentMethod(body?.metodoPago);
    const clienteCodigo = await this.findClientCodeByUserCode(actor.codigo);

    return this.createConfirmedAppointmentForRequest(actor, {
      usuarioCodigo,
      mascotaCodigo,
      clienteCodigo,
      fecha,
      hora,
      serviciosCodigos,
      metodoPago,
    });
  }

  async completeAppointment(
    codigo: string,
    actor: AuthenticatedUser,
  ): Promise<AppointmentStateResponse> {
    this.ensureActorRole(actor, ['VETERINARIO']);
    const appointmentCode = this.requiredString(codigo, 'codigo');

    const appointment = await this.db.cita.findUnique({
      where: { codigo: appointmentCode },
      include: { pago: true },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    if (appointment.usuario_codigo !== actor.codigo) {
      throw new ForbiddenException(
        'Solo el veterinario asignado puede finalizar la cita',
      );
    }

    if (appointment.estado === 'cancelada') {
      throw new ConflictException('No se puede finalizar una cita cancelada');
    }

    if (appointment.estado === 'completada') {
      throw new ConflictException('La cita ya fue finalizada');
    }

    if (appointment.estado !== 'confirmada') {
      throw new ConflictException('Solo se pueden finalizar citas confirmadas');
    }

    if (!appointment.pago) {
      throw new ConflictException(
        'No se puede finalizar una cita sin pago registrado',
      );
    }

    const updated = await this.db.cita.update({
      where: { codigo: appointmentCode },
      data: { estado: 'completada' },
    });

    const completedAppointment = this.mapAppointmentState(updated);

    await this.emitAuditSafely(actor, {
      action: AuditAction.CAMBIO_ESTADO_CITA,
      entityType: 'Appointment',
      entityId: completedAppointment.codigo,
      details: {
        estadoAnterior: appointment.estado,
        estadoNuevo: completedAppointment.estado,
        cita: completedAppointment,
      },
    });

    await this.emitAuditSafely(actor, {
      action: AuditAction.FINALIZACION_CITA,
      entityType: 'Appointment',
      entityId: completedAppointment.codigo,
      details: {
        cita: completedAppointment,
      },
    });

    return completedAppointment;
  }

  async cancelAppointment(
    codigo: string,
    actor: AuthenticatedUser,
    body: CancelAppointmentRequest,
  ): Promise<AppointmentStateResponse> {
    this.ensureActorRole(actor, ['CLIENTE', 'RECEPCIONISTA', 'VETERINARIO']);
    const appointmentCode = this.requiredString(codigo, 'codigo');
    const motivo = this.requiredString(body?.motivo, 'motivo');

    const appointment = await this.db.cita.findUnique({
      where: { codigo: appointmentCode },
    });

    if (!appointment) {
      throw new NotFoundException('Cita no encontrada');
    }

    await this.ensureCanCancelAppointment(actor, appointment);

    if (appointment.estado === 'cancelada') {
      throw new ConflictException('La cita ya esta cancelada');
    }

    if (appointment.estado === 'completada') {
      throw new ConflictException('No se puede cancelar una cita finalizada');
    }

    const updated = await this.db.cita.update({
      where: { codigo: appointmentCode },
      data: {
        estado: 'cancelada',
        motivo_cancelacion: motivo,
      },
    });

    const canceledAppointment = this.mapAppointmentState(updated);

    await this.emitAuditSafely(actor, {
      action: AuditAction.CAMBIO_ESTADO_CITA,
      entityType: 'Appointment',
      entityId: canceledAppointment.codigo,
      details: {
        estadoAnterior: appointment.estado,
        estadoNuevo: canceledAppointment.estado,
        motivoCancelacion: canceledAppointment.motivoCancelacion,
        cita: canceledAppointment,
      },
    });

    await this.emitAuditSafely(actor, {
      action: AuditAction.CANCELACION_CITA,
      entityType: 'Appointment',
      entityId: canceledAppointment.codigo,
      details: {
        motivoCancelacion: canceledAppointment.motivoCancelacion,
        cita: canceledAppointment,
      },
    });

    return canceledAppointment;
  }

  async isAvailable(
    usuarioCodigo: string,
    fecha: string,
    hora: string,
  ): Promise<boolean> {
    const veterinarianCode = this.requiredString(usuarioCodigo, 'usuarioCodigo');
    const normalizedDate = this.normalizeDate(fecha);
    const normalizedTime = this.normalizeTime(hora);

    await this.ensureVeterinarianExists(this.db, veterinarianCode);

    return this.isAvailableWithRunner(
      this.db,
      veterinarianCode,
      this.parseDate(normalizedDate),
      this.parseTime(normalizedTime),
    );
  }

  async findDailyAgenda(
    actor: AuthenticatedUser,
    veterinarioCodigo: string,
    fecha: string,
  ): Promise<DailyAgendaAppointmentResponse[]> {
    this.ensureActorRole(actor, ['RECEPCIONISTA', 'VETERINARIO']);
    const veterinarianCode = this.requiredString(
      veterinarioCodigo,
      'veterinarioCodigo',
    );
    const normalizedDate = this.normalizeDate(fecha);

    if (this.normalizeRole(actor.rol) === 'VETERINARIO' && actor.codigo !== veterinarianCode) {
      throw new ForbiddenException(
        'El veterinario solo puede consultar su propia agenda diaria',
      );
    }

    const citas = await this.db.cita.findMany({
      where: {
        usuario_codigo: veterinarianCode,
        fecha: this.parseDate(normalizedDate),
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

    return citas.map((c: any) => {
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
        servicios: c.cita_servicios.map((s: any) => ({
          codigo: s.servicio_codigo,
          nombre: s.nombre,
          precioUnitario: Number(s.precio_unitario),
        })),
      };
    });
  }

  private async createConfirmedAppointmentForRequest(
    actor: AuthenticatedUser,
    request: ValidatedAppointmentRequest,
  ): Promise<CreatedAppointmentResponse> {
    let createdAppointment!: CreatedAppointmentResponse;

    await this.db.$transaction(async (tx: any) => {
      const fecha = this.parseDate(request.fecha);
      const hora = this.parseTime(request.hora);

      await this.ensureVeterinarianExists(tx, request.usuarioCodigo);
      await this.ensureClientExists(tx, request.clienteCodigo);
      await this.ensurePetBelongsToClientWithRunner(
        tx,
        request.mascotaCodigo,
        request.clienteCodigo,
      );

      const available = await this.isAvailableWithRunner(
        tx,
        request.usuarioCodigo,
        fecha,
        hora,
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
          fecha,
          hora,
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

      if (!appointment.pago) {
        throw new ConflictException('No se pudo registrar el pago de la cita');
      }

      createdAppointment = {
        codigo: appointment.codigo,
        total,
        estado: appointment.estado,
        servicios: services,
        pago: {
          codigo: appointment.pago.codigo,
          monto: total,
          metodoPago: appointment.pago.metodo_pago as MetodoPago,
          estado: 'aprobado',
          fecha: appointment.pago.fecha.toISOString().split('T')[0],
        },
      };
    }, { isolationLevel: 'Serializable' });

    await this.emitAuditSafely(actor, {
      action: AuditAction.CREACION_CITA,
      entityType: 'Appointment',
      entityId: createdAppointment.codigo,
      details: {
        cita: {
          codigo: createdAppointment.codigo,
          usuarioCodigo: request.usuarioCodigo,
          mascotaCodigo: request.mascotaCodigo,
          clienteCodigo: request.clienteCodigo,
          fecha: request.fecha,
          hora: request.hora,
          estado: createdAppointment.estado,
          total: createdAppointment.total,
          servicios: createdAppointment.servicios,
        },
      },
    });

    await this.emitAuditSafely(actor, {
      action: AuditAction.PAGO_CITA_REGISTRADO,
      entityType: 'Payment',
      entityId: createdAppointment.pago.codigo,
      details: {
        citaCodigo: createdAppointment.codigo,
        proveedor: 'mock',
        resultado: 'aprobado',
        pago: createdAppointment.pago,
      },
    });

    await this.sendConfirmationEmailSafely(request, createdAppointment);

    return createdAppointment;
  }

  private validateCreateAppointmentRequest(
    body: CreateAppointmentRequest,
  ): ValidatedAppointmentRequest {
    return {
      usuarioCodigo: this.requiredString(body?.usuarioCodigo, 'usuarioCodigo'),
      mascotaCodigo: this.requiredString(body?.mascotaCodigo, 'mascotaCodigo'),
      clienteCodigo: this.requiredString(body?.clienteCodigo, 'clienteCodigo'),
      fecha: this.normalizeDate(body?.fecha),
      hora: this.normalizeTime(body?.hora),
      serviciosCodigos: this.validateServiceCodes(body?.serviciosCodigos),
      metodoPago: this.validatePaymentMethod(body?.metodoPago),
    };
  }

  private validateServiceCodes(value: unknown): string[] {
    if (!Array.isArray(value) || value.length === 0) {
      throw new BadRequestException('serviciosCodigos debe ser un arreglo no vacío');
    }

    return value.map((codigo, index) => {
      if (typeof codigo !== 'string' || codigo.trim().length === 0) {
        throw new BadRequestException(
          `serviciosCodigos[${index}] debe ser un código válido`,
        );
      }

      return codigo.trim();
    });
  }

  private validatePaymentMethod(value: unknown): MetodoPago {
    const metodoPago = this.requiredString(value, 'metodoPago');

    if (!VALID_PAYMENT_METHODS.includes(metodoPago as MetodoPago)) {
      throw new BadRequestException(
        'metodoPago debe ser efectivo, tarjeta, transferencia u otro',
      );
    }

    return metodoPago as MetodoPago;
  }

  private requiredString(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException(`${field} es obligatorio`);
    }

    return value.trim();
  }

  private normalizeDate(value: unknown): string {
    const dateStr = this.requiredString(value, 'fecha');

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      throw new BadRequestException('fecha debe tener formato YYYY-MM-DD');
    }

    const date = new Date(`${dateStr}T00:00:00.000Z`);

    if (Number.isNaN(date.getTime()) || date.toISOString().split('T')[0] !== dateStr) {
      throw new BadRequestException('fecha debe ser una fecha válida');
    }

    return dateStr;
  }

  private normalizeTime(value: unknown): string {
    const timeStr = this.requiredString(value, 'hora');

    if (!/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(timeStr)) {
      throw new BadRequestException('hora debe tener formato HH:mm o HH:mm:ss');
    }

    return timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  }

  private parseDate(dateStr: string): Date {
    return new Date(`${dateStr}T00:00:00.000Z`);
  }

  private parseTime(timeStr: string): Date {
    return new Date(`1970-01-01T${timeStr}Z`);
  }

  private async findClientCodeByUserCode(userCode: string): Promise<string> {
    const cliente = await this.db.cliente.findUnique({
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

  private async ensureVeterinarianExists(runner: any, usuarioCodigo: string): Promise<void> {
    const veterinarian = await runner.usuario.findUnique({
      where: { codigo: usuarioCodigo },
      select: { codigo: true, rol: true, estado: true },
    });

    if (
      !veterinarian ||
      veterinarian.rol !== 'VETERINARIO' ||
      (veterinarian.estado && veterinarian.estado !== 'activo')
    ) {
      throw new BadRequestException(
        'usuarioCodigo debe corresponder a un veterinario activo',
      );
    }
  }

  private async ensureClientExists(runner: any, clienteCodigo: string): Promise<void> {
    const cliente = await runner.cliente.findUnique({
      where: { codigo: clienteCodigo },
      select: { codigo: true },
    });

    if (!cliente) {
      throw new BadRequestException('clienteCodigo debe corresponder a un cliente existente');
    }
  }

  private async ensurePetBelongsToClientWithRunner(
    runner: any,
    mascotaCodigo: string,
    clienteCodigo: string,
  ): Promise<void> {
    const mascota = await runner.mascotas.findFirst({
      where: {
        codigo: mascotaCodigo,
        cliente_codigo: clienteCodigo,
      },
      select: { codigo: true },
    });

    if (!mascota) {
      throw new ForbiddenException(
        'La mascota indicada no pertenece al cliente autenticado',
      );
    }
  }

  private async ensureCanCancelAppointment(actor: AuthenticatedUser, appointment: any): Promise<void> {
    const role = this.normalizeRole(actor.rol);

    if (role === 'RECEPCIONISTA') {
      return;
    }

    if (role === 'VETERINARIO' && appointment.usuario_codigo === actor.codigo) {
      return;
    }

    if (role === 'CLIENTE') {
      const clienteCodigo = await this.findClientCodeByUserCode(actor.codigo);

      if (appointment.cliente_codigo === clienteCodigo) {
        return;
      }
    }

    throw new ForbiddenException('No tiene permisos para cancelar esta cita');
  }

  private async isAvailableWithRunner(
    runner: any,
    usuarioCodigo: string,
    fecha: Date,
    hora: Date,
  ): Promise<boolean> {
    const cita = await runner.cita.findFirst({
      where: {
        usuario_codigo: usuarioCodigo,
        fecha,
        hora,
        estado: { not: 'cancelada' },
      },
    });

    return !cita;
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

  private async sendConfirmationEmailSafely(
    request: ValidatedAppointmentRequest,
    createdAppointment: CreatedAppointmentResponse,
  ): Promise<void> {
    try {
      const emailData = await this.getAppointmentEmailData(
        request.clienteCodigo,
        request.mascotaCodigo,
        request.usuarioCodigo,
      );
      await this.mailService.sendAppointmentConfirmation(emailData.correo, {
        nombreCliente: emailData.nombreCliente,
        nombreMascota: emailData.nombreMascota,
        nombreVeterinario: emailData.nombreVeterinario,
        fecha: request.fecha,
        hora: request.hora,
        servicios: createdAppointment.servicios,
        total: createdAppointment.total,
      });
    } catch {
      console.error(`No se pudo enviar el correo de confirmacion de la cita ${createdAppointment.codigo}`);
    }
  }

  private async getAppointmentEmailData(
    clienteCodigo: string,
    mascotaCodigo: string,
    veterinarioCodigo: string,
  ): Promise<{
    correo: string;
    nombreCliente: string;
    nombreMascota: string;
    nombreVeterinario: string;
  }> {
    const [cliente, mascota, veterinario] = await Promise.all([
      this.db.cliente.findUnique({
        where: { codigo: clienteCodigo },
        include: { usuario: { select: { correo: true, nombre: true, apellido: true } } },
      }),
      this.db.mascotas.findUnique({
        where: { codigo: mascotaCodigo },
        select: { nombre: true },
      }),
      this.db.usuario.findUnique({
        where: { codigo: veterinarioCodigo },
        select: { nombre: true, apellido: true },
      }),
    ]);

    if (!cliente || !cliente.usuario) {
      throw new Error(`No se encontro el cliente con codigo ${clienteCodigo} para enviar el correo`);
    }
    if (!mascota) {
      throw new Error(`No se encontro la mascota con codigo ${mascotaCodigo} para enviar el correo`);
    }
    if (!veterinario) {
      throw new Error(`No se encontro el veterinario con codigo ${veterinarioCodigo} para enviar el correo`);
    }

    return {
      correo: cliente.usuario.correo,
      nombreCliente: `${cliente.usuario.nombre} ${cliente.usuario.apellido}`,
      nombreMascota: mascota.nombre,
      nombreVeterinario: `${veterinario.nombre} ${veterinario.apellido}`,
    };
  }

  private mapAppointmentState(appointment: any): AppointmentStateResponse {
    return {
      codigo: appointment.codigo,
      usuarioCodigo: appointment.usuario_codigo,
      mascotaCodigo: appointment.mascota_codigo,
      clienteCodigo: appointment.cliente_codigo,
      fecha: appointment.fecha.toISOString().split('T')[0],
      hora: appointment.hora.toISOString().split('T')[1].substring(0, 8),
      estado: appointment.estado,
      total: Number(appointment.total),
      motivoCancelacion: appointment.motivo_cancelacion ?? null,
    };
  }

  private ensureActorRole(actor: AuthenticatedUser, allowedRoles: RolAutenticado[]): void {
    const role = this.normalizeRole(actor?.rol);

    if (!actor?.codigo || !allowedRoles.includes(role)) {
      throw new ForbiddenException(
        `Acceso denegado. Se requiere uno de los siguientes roles: ${allowedRoles.join(', ')}`,
      );
    }
  }

  private normalizeRole(role: string | undefined): RolAutenticado {
    return (role ?? '').toUpperCase() as RolAutenticado;
  }

  private toAuditRole(role: string): RolAuditoria {
    const normalizedRole = this.normalizeRole(role);
    const auditRole = AUDIT_ROLE_BY_AUTH_ROLE[normalizedRole];

    if (!auditRole) {
      throw new ForbiddenException('Rol de usuario autenticado no soportado');
    }

    return auditRole;
  }

  private async emitAuditSafely(
    actor: AuthenticatedUser,
    event: AuditAppointmentEvent,
  ): Promise<void> {
    try {
      await this.auditService.emit({
        action: event.action,
        userId: actor.codigo,
        userRole: this.toAuditRole(actor.rol),
        entityType: event.entityType,
        entityId: event.entityId,
        details: {
          actor: {
            codigo: actor.codigo,
            rol: this.normalizeRole(actor.rol),
          },
          ...event.details,
        },
        ipAddress: actor.ipAddress,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // El flujo principal de citas no debe depender de bh-audit.
    }
  }
}
