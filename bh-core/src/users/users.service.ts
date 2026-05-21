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
