import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../database/database.provider';
import { AuditService } from '../audit/audit.service';
import { formatColombiaDate } from '../common/date.util';

/**
 * Servicio de gestion de usuarios.
 * Permite al administrador aprobar, rechazar y suspender cuentas de usuarios.
 */
@Injectable()
export class UsersService {
  constructor(
    @Inject(DATABASE_POOL) private readonly pool: Pool,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Retorna la lista de cuentas de recepcionistas y veterinarios pendientes de aprobacion.
   * - Solo incluye usuarios con rol RECEPCIONISTA o VETERINARIO
   * - Solo incluye usuarios con estado pendiente_aprobacion
   * - Retorna nombre, apellido, correo, rol y fecha de solicitud de cada cuenta
   * - Las fechas se muestran en hora Colombia (UTC-5)
   *
   * @returns Lista de cuentas pendientes de aprobacion
   */
  async getPendingUsers() {
    const { rows } = await this.pool.query(
      `SELECT codigo, nombre, apellido, correo, rol, creado_en
       FROM usuario
       WHERE estado = 'pendiente_aprobacion'
         AND rol IN ('RECEPCIONISTA', 'VETERINARIO')
       ORDER BY creado_en ASC`,
    );

    return {
      total: rows.length,
      usuarios: rows.map((u) => ({
        codigo: u.codigo,
        nombre: u.nombre,
        apellido: u.apellido,
        correo: u.correo,
        rol: u.rol,
        fechaSolicitud: formatColombiaDate(u.creado_en),
      })),
    };
  }

  /**
   * Suspende la cuenta de un usuario activo.
   * - Valida que el ID tenga formato UUID valido
   * - Valida que el motivo de suspension sea obligatorio, minimo 10 y maximo 255 caracteres
   * - Verifica que el usuario exista en la base de datos
   * - Verifica que la cuenta este en estado activo
   * - Actualiza el estado de la cuenta a suspendido
   * - Emite evento de auditoria SUSPENSION_DE_USUARIO
   *
   * @param id - Codigo UUID del usuario a suspender
   * @param body - { motivo }
   * @returns Mensaje de exito y datos del usuario suspendido
   */
  async suspendUser(id: string, body: any) {
    const { motivo } = body;

    // Validacion de formato UUID
    const regexUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!regexUUID.test(id)) {
      throw new BadRequestException('El identificador del usuario no tiene un formato valido');
    }

    // Validacion del motivo de suspension
    if (!motivo) {
      throw new BadRequestException('El motivo de la suspension es obligatorio');
    }
    if (typeof motivo !== 'string' || motivo.trim().length === 0) {
      throw new BadRequestException('El motivo de la suspension no puede estar vacio');
    }
    if (motivo.trim().length < 10) {
      throw new BadRequestException('El motivo de la suspension debe tener al menos 10 caracteres');
    }
    if (motivo.trim().length > 255) {
      throw new BadRequestException('El motivo de la suspension no puede tener mas de 255 caracteres');
    }

    // Buscar usuario por codigo UUID
    const { rows } = await this.pool.query(
      `SELECT codigo, nombre, apellido, correo, rol, estado
       FROM usuario WHERE codigo = $1 LIMIT 1`,
      [id],
    );

    if (rows.length === 0) {
      throw new NotFoundException('No existe un usuario con ese codigo');
    }

    const usuario = rows[0];

    // Verificar que la cuenta este activa
    if (usuario.estado !== 'activo') {
      throw new BadRequestException(
        `Solo se pueden suspender cuentas activas. Estado actual: ${usuario.estado}`,
      );
    }

    // Suspender la cuenta actualizando el estado a suspendido
    await this.pool.query(
      `UPDATE usuario SET estado = 'suspendido' WHERE codigo = $1`,
      [id],
    );

    // Emitir evento de auditoria
    this.auditService.emit({
      action: 'SUSPENSION_DE_USUARIO',
      userId: usuario.codigo,
      userRole: usuario.rol,
      entityType: 'Usuario',
      entityId: usuario.codigo,
      details: { correo: usuario.correo, rol: usuario.rol, motivo: motivo.trim() },
    });

    return {
      mensaje: `La cuenta de ${usuario.nombre} ${usuario.apellido} ha sido suspendida.`,
      codigo: usuario.codigo,
      correo: usuario.correo,
      rol: usuario.rol,
      estado: 'suspendido',
      motivo: motivo.trim(),
    };
  }

  /**
   * Rechaza la cuenta de un recepcionista o veterinario pendiente de aprobacion.
   * - Valida que el ID tenga formato UUID valido
   * - Valida que el motivo del rechazo sea obligatorio y sin espacios al inicio o final
   * - Verifica que el usuario exista en la base de datos
   * - Verifica que el usuario sea RECEPCIONISTA o VETERINARIO (no CLIENTE ni ADMIN)
   * - Verifica que la cuenta este en estado pendiente_aprobacion
   * - Actualiza el estado de la cuenta a rechazado
   * - Emite evento de auditoria RECHAZO_DE_CUENTA
   *
   * @param id - Codigo UUID del usuario a rechazar
   * @param body - { motivo }
   * @returns Mensaje de exito y datos del usuario rechazado
   */
  async rejectUser(id: string, body: any) {
    const { motivo } = body;

    // Validacion de formato UUID
    const regexUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!regexUUID.test(id)) {
      throw new BadRequestException('El identificador del usuario no tiene un formato valido');
    }

    // Validacion del motivo de rechazo
    if (!motivo) {
      throw new BadRequestException('El motivo del rechazo es obligatorio');
    }
    if (typeof motivo !== 'string' || motivo.trim().length === 0) {
      throw new BadRequestException('El motivo del rechazo no puede estar vacio');
    }
    if (motivo.trim().length < 10) {
      throw new BadRequestException('El motivo del rechazo debe tener al menos 10 caracteres');
    }
    if (motivo.trim().length > 255) {
      throw new BadRequestException('El motivo del rechazo no puede tener mas de 255 caracteres');
    }

    // Buscar usuario por codigo UUID
    const { rows } = await this.pool.query(
      `SELECT codigo, nombre, apellido, correo, rol, estado
       FROM usuario WHERE codigo = $1 LIMIT 1`,
      [id],
    );

    if (rows.length === 0) {
      throw new NotFoundException('No existe un usuario con ese codigo');
    }

    const usuario = rows[0];

    // Verificar que el rol sea RECEPCIONISTA o VETERINARIO
    const rolesRechazables = ['RECEPCIONISTA', 'VETERINARIO'];
    if (!rolesRechazables.includes(usuario.rol)) {
      throw new BadRequestException(
        'Solo se pueden rechazar cuentas de recepcionistas o veterinarios',
      );
    }

    // Verificar que la cuenta este pendiente de aprobacion
    if (usuario.estado !== 'pendiente_aprobacion') {
      throw new BadRequestException(
        `La cuenta no esta pendiente de aprobacion. Estado actual: ${usuario.estado}`,
      );
    }

    // Rechazar la cuenta actualizando el estado a rechazado
    await this.pool.query(
      `UPDATE usuario SET estado = 'rechazado' WHERE codigo = $1`,
      [id],
    );

    // Emitir evento de auditoria
    this.auditService.emit({
      action: 'RECHAZO_DE_CUENTA',
      userId: usuario.codigo,
      userRole: usuario.rol,
      entityType: 'Usuario',
      entityId: usuario.codigo,
      details: { correo: usuario.correo, rol: usuario.rol, motivo: motivo.trim() },
    });

    return {
      mensaje: `La cuenta de ${usuario.nombre} ${usuario.apellido} ha sido rechazada.`,
      codigo: usuario.codigo,
      correo: usuario.correo,
      rol: usuario.rol,
      estado: 'rechazado',
      motivo: motivo.trim(),
    };
  }

  /**
   * Aprueba la cuenta de un recepcionista o veterinario pendiente de aprobacion.
   * - Valida que el ID tenga formato UUID valido
   * - Verifica que el usuario exista en la base de datos
   * - Verifica que el usuario sea RECEPCIONISTA o VETERINARIO (no CLIENTE ni ADMIN)
   * - Verifica que la cuenta este en estado pendiente_aprobacion
   * - Actualiza el estado de la cuenta a activo
   * - Emite evento de auditoria APROBACION_DE_CUENTA
   *
   * @param id - Codigo UUID del usuario a aprobar
   * @returns Mensaje de exito y datos del usuario aprobado
   */
  async approveUser(id: string) {

    // Validacion de formato UUID
    const regexUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!regexUUID.test(id)) {
      throw new BadRequestException('El identificador del usuario no tiene un formato valido');
    }

    // Buscar usuario por codigo UUID
    const { rows } = await this.pool.query(
      `SELECT codigo, nombre, apellido, correo, rol, estado
       FROM usuario WHERE codigo = $1 LIMIT 1`,
      [id],
    );

    if (rows.length === 0) {
      throw new NotFoundException('No existe un usuario con ese codigo');
    }

    const usuario = rows[0];

    // Verificar que el rol sea RECEPCIONISTA o VETERINARIO
    const rolesAprobables = ['RECEPCIONISTA', 'VETERINARIO'];
    if (!rolesAprobables.includes(usuario.rol)) {
      throw new BadRequestException(
        'Solo se pueden aprobar cuentas de recepcionistas o veterinarios',
      );
    }

    // Verificar que la cuenta este pendiente de aprobacion
    if (usuario.estado !== 'pendiente_aprobacion') {
      throw new BadRequestException(
        `La cuenta no esta pendiente de aprobacion. Estado actual: ${usuario.estado}`,
      );
    }

    // Aprobar la cuenta actualizando el estado a activo
    await this.pool.query(
      `UPDATE usuario SET estado = 'activo' WHERE codigo = $1`,
      [id],
    );

    // Emitir evento de auditoria
    this.auditService.emit({
      action: 'APROBACION_DE_CUENTA',
      userId: usuario.codigo,
      userRole: usuario.rol,
      entityType: 'Usuario',
      entityId: usuario.codigo,
      details: { correo: usuario.correo, rol: usuario.rol },
    });

    return {
      mensaje: `La cuenta de ${usuario.nombre} ${usuario.apellido} ha sido aprobada exitosamente.`,
      codigo: usuario.codigo,
      correo: usuario.correo,
      rol: usuario.rol,
      estado: 'activo',
    };
  }
}
