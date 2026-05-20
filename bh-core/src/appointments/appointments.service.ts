import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';

import { AuditService } from '../audit/audit.service';
import { DATABASE_POOL } from '../database/database.provider';

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

interface QueryRunner {
  query<T = any>(
    query: string,
    values?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number }>;
}

interface ServiceRow {
  codigo: string;
  nombre: string;
  precio: number | string;
}

interface AppointmentRow {
  codigo: string;
  estado: string;
}

interface ClientRow {
  codigo: string;
}

interface PaymentRow {
  codigo: string;
  metodoPago: MetodoPago;
  fecha: string;
}

interface DailyAgendaAppointmentRow {
  codigo: string;
  fecha: string;
  hora: string;
  estado: string;
  total: number | string;
  mascotaCodigo: string;
  mascotaNombre: string;
  mascotaEspecie: string;
  mascotaRaza: string;
  clienteCodigo: string;
  clienteUsuarioCodigo: string;
  clienteNombre: string;
  clienteApellido: string;
  clienteCorreo: string;
  clienteCiudad: string;
  servicios: AppointmentServiceResponse[];
}

interface CompletedAppointmentRow {
  codigo: string;
  usuarioCodigo: string;
  mascotaCodigo: string;
  clienteCodigo: string;
  fecha: string;
  hora: string;
  estado: string;
  total: number | string;
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
    @Inject(DATABASE_POOL) private readonly pool: Pool,
    private readonly auditService: AuditService,
  ) {}

  async createConfirmedAppointment(
    body: CreateAppointmentRequest,
  ): Promise<CreatedAppointmentResponse> {
    const request = this.validateCreateAppointmentRequest(body);
    const client = await this.pool.connect();
    let createdAppointment: CreatedAppointmentResponse;

    try {
      await client.query('BEGIN');

      const available = await this.isAvailableWithRunner(
        client,
        request.usuarioCodigo,
        request.fecha,
        request.hora,
      );

      if (!available) {
        throw new ConflictException(
          'No hay disponibilidad para el veterinario en la fecha y hora indicadas',
        );
      }

      const services = await this.findActiveServices(client, request.serviciosCodigos);
      const total = Number(
        services
          .reduce((sum, service) => sum + service.precioUnitario, 0)
          .toFixed(2),
      );

      const appointmentResult = await client.query<AppointmentRow>(
        `
          INSERT INTO cita (
            usuario_codigo,
            mascota_codigo,
            cliente_codigo,
            fecha,
            hora,
            estado,
            total
          )
          VALUES ($1, $2, $3, $4::date, $5::time, 'confirmada', $6)
          RETURNING codigo, estado
        `,
        [
          request.usuarioCodigo,
          request.mascotaCodigo,
          request.clienteCodigo,
          request.fecha,
          request.hora,
          total,
        ],
      );

      const appointment = appointmentResult.rows[0];

      for (const service of services) {
        await client.query(
          `
            INSERT INTO cita_servicios (
              cita_codigo,
              servicio_codigo,
              nombre,
              precio_unitario
            )
            VALUES ($1, $2, $3, $4)
          `,
          [appointment.codigo, service.codigo, service.nombre, service.precioUnitario],
        );
      }

      const paymentResult = await client.query<PaymentRow>(
        `
          INSERT INTO pago (cita_codigo, monto, metodo_pago, fecha)
          VALUES ($1, $2, $3, CURRENT_DATE)
          RETURNING codigo, metodo_pago AS "metodoPago", fecha
        `,
        [appointment.codigo, total, request.metodoPago],
      );

      const payment = paymentResult.rows[0];

      createdAppointment = {
        codigo: appointment.codigo,
        total,
        estado: appointment.estado,
        servicios: services,
        pago: {
          codigo: payment.codigo,
          monto: total,
          metodoPago: payment.metodoPago,
          fecha: payment.fecha,
        },
      };

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    this.auditService.emit({
      action: 'CREACION_CITA',
      userId: request.usuarioCodigo,
      userRole: 'veterinario',
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

    this.auditService.emit({
      action: 'PAGO_CITA_REGISTRADO',
      userId: null,
      userRole: null,
      entityType: 'Payment',
      entityId: createdAppointment.pago.codigo,
      details: {
        citaCodigo: createdAppointment.codigo,
        pago: createdAppointment.pago,
      },
    });

    return createdAppointment;
  }

  async isAvailable(
    usuarioCodigo: string,
    fecha: string,
    hora: string,
  ): Promise<boolean> {
    return this.isAvailableWithRunner(this.pool, usuarioCodigo, fecha, hora);
  }

  async findDailyAgenda(
    veterinarioCodigo: string,
    fecha: string,
  ): Promise<DailyAgendaAppointmentResponse[]> {
    const result = await this.pool.query<DailyAgendaAppointmentRow>(
      `
        SELECT
          c.codigo,
          c.fecha::text AS fecha,
          c.hora::text AS hora,
          c.estado,
          c.total,
          m.codigo AS "mascotaCodigo",
          m.nombre AS "mascotaNombre",
          m.especie AS "mascotaEspecie",
          m.raza AS "mascotaRaza",
          cl.codigo AS "clienteCodigo",
          cl.usuario_codigo AS "clienteUsuarioCodigo",
          cu.nombre AS "clienteNombre",
          cu.apellido AS "clienteApellido",
          cu.correo AS "clienteCorreo",
          cl.ciudad AS "clienteCiudad",
          COALESCE(
            JSON_AGG(
              JSON_BUILD_OBJECT(
                'codigo', cs.servicio_codigo,
                'nombre', cs.nombre,
                'precioUnitario', cs.precio_unitario
              )
              ORDER BY cs.nombre
            ) FILTER (WHERE cs.codigo IS NOT NULL),
            '[]'::json
          ) AS servicios
        FROM cita c
        INNER JOIN mascotas m ON m.codigo = c.mascota_codigo
        INNER JOIN cliente cl ON cl.codigo = c.cliente_codigo
        INNER JOIN usuario cu ON cu.codigo = cl.usuario_codigo
        LEFT JOIN cita_servicios cs ON cs.cita_codigo = c.codigo
        WHERE c.usuario_codigo = $1
          AND c.fecha = $2::date
        GROUP BY
          c.codigo,
          c.fecha,
          c.hora,
          c.estado,
          c.total,
          m.codigo,
          m.nombre,
          m.especie,
          m.raza,
          cl.codigo,
          cl.usuario_codigo,
          cu.nombre,
          cu.apellido,
          cu.correo,
          cl.ciudad
        ORDER BY c.hora ASC
      `,
      [veterinarioCodigo, fecha],
    );

    return result.rows.map((appointment) => ({
      cita: {
        codigo: appointment.codigo,
        fecha: appointment.fecha,
        hora: appointment.hora,
      },
      estado: appointment.estado,
      total: Number(appointment.total),
      mascota: {
        codigo: appointment.mascotaCodigo,
        nombre: appointment.mascotaNombre,
        especie: appointment.mascotaEspecie,
        raza: appointment.mascotaRaza,
      },
      cliente: {
        codigo: appointment.clienteCodigo,
        usuarioCodigo: appointment.clienteUsuarioCodigo,
        nombre: appointment.clienteNombre,
        apellido: appointment.clienteApellido,
        correo: appointment.clienteCorreo,
        ciudad: appointment.clienteCiudad,
      },
      servicios: appointment.servicios.map((service) => ({
        codigo: service.codigo,
        nombre: service.nombre,
        precioUnitario: Number(service.precioUnitario),
      })),
    }));
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

    const appointmentResult = await this.pool.query<CompletedAppointmentRow>(
      `
        SELECT
          codigo,
          usuario_codigo AS "usuarioCodigo",
          mascota_codigo AS "mascotaCodigo",
          cliente_codigo AS "clienteCodigo",
          fecha::text AS fecha,
          hora::text AS hora,
          estado,
          total
        FROM cita
        WHERE codigo = $1
        LIMIT 1
      `,
      [appointmentCode],
    );

    if (appointmentResult.rowCount === 0) {
      throw new NotFoundException('Cita no encontrada');
    }

    const appointment = appointmentResult.rows[0];

    if (appointment.usuarioCodigo !== userCode) {
      throw new ForbiddenException(
        'Solo el veterinario asignado puede finalizar la cita',
      );
    }

    if (appointment.estado === 'cancelada' || appointment.estado === 'completada') {
      throw new ConflictException(
        'No se puede finalizar una cita cancelada o completada',
      );
    }

    const updatedResult = await this.pool.query<CompletedAppointmentRow>(
      `
        UPDATE cita
        SET estado = 'completada'
        WHERE codigo = $1
        RETURNING
          codigo,
          usuario_codigo AS "usuarioCodigo",
          mascota_codigo AS "mascotaCodigo",
          cliente_codigo AS "clienteCodigo",
          fecha::text AS fecha,
          hora::text AS hora,
          estado,
          total
      `,
      [appointmentCode],
    );

    return this.toCompletedAppointmentResponse(updatedResult.rows[0]);
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
    const result = await this.pool.query<ClientRow>(
      `
        SELECT codigo
        FROM cliente
        WHERE usuario_codigo = $1
        LIMIT 1
      `,
      [userCode],
    );

    if (result.rowCount === 0) {
      throw new ForbiddenException(
        'No existe un cliente asociado al usuario autenticado',
      );
    }

    return result.rows[0].codigo;
  }

  private async ensurePetBelongsToClient(
    mascotaCodigo: string,
    clienteCodigo: string,
  ): Promise<void> {
    const result = await this.pool.query(
      `
        SELECT 1
        FROM mascotas
        WHERE codigo = $1
          AND cliente_codigo = $2
        LIMIT 1
      `,
      [mascotaCodigo, clienteCodigo],
    );

    if (result.rowCount === 0) {
      throw new ForbiddenException(
        'La mascota indicada no pertenece al cliente autenticado',
      );
    }
  }

  private async isAvailableWithRunner(
    runner: QueryRunner,
    usuarioCodigo: string,
    fecha: string,
    hora: string,
  ): Promise<boolean> {
    const result = await runner.query(
      `
        SELECT 1
        FROM cita
        WHERE usuario_codigo = $1
          AND fecha = $2::date
          AND hora = $3::time
          AND estado <> 'cancelada'
        LIMIT 1
      `,
      [usuarioCodigo, fecha, hora],
    );

    return result.rowCount === 0;
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

  private toCompletedAppointmentResponse(
    appointment: CompletedAppointmentRow,
  ): CompletedAppointmentResponse {
    return {
      codigo: appointment.codigo,
      usuarioCodigo: appointment.usuarioCodigo,
      mascotaCodigo: appointment.mascotaCodigo,
      clienteCodigo: appointment.clienteCodigo,
      fecha: appointment.fecha,
      hora: appointment.hora,
      estado: appointment.estado,
      total: Number(appointment.total),
    };
  }

  private async findActiveServices(
    runner: QueryRunner,
    serviceCodes: string[],
  ): Promise<AppointmentServiceResponse[]> {
    const uniqueServiceCodes = [...new Set(serviceCodes)];
    const result = await runner.query<ServiceRow>(
      `
        SELECT codigo, nombre, precio
        FROM servicio
        WHERE codigo = ANY($1::varchar[])
          AND estado = 'activo'
      `,
      [uniqueServiceCodes],
    );

    const servicesByCode = new Map(
      result.rows.map((service) => [service.codigo, service]),
    );

    const invalidServiceCode = uniqueServiceCodes.find(
      (serviceCode) => !servicesByCode.has(serviceCode),
    );

    if (invalidServiceCode) {
      throw new BadRequestException('Todos los servicios deben existir y estar activos');
    }

    return serviceCodes.map((serviceCode) => {
      const service = servicesByCode.get(serviceCode);

      return {
        codigo: service.codigo,
        nombre: service.nombre,
        precioUnitario: Number(service.precio),
      };
    });
  }
}
