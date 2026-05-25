import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/enums/audit-action.enum';
import { formatColombiaDate } from '../common/date.util';

/**
 * Servicio de gestion de usuarios.
 * Permite al administrador aprobar, rechazar y suspender cuentas de usuarios.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
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
    const usuarios = await this.prisma.usuario.findMany({
      where: {
        estado: 'pendiente_aprobacion',
        rol: { in: ['RECEPCIONISTA', 'VETERINARIO'] },
      },
      orderBy: { creado_en: 'asc' },
    });

    return {
      total: usuarios.length,
      usuarios: usuarios.map((u) => ({
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
   * Retorna el listado completo de usuarios registrados en el sistema.
   * - Permite filtrar por rol y/o estado de forma opcional
   * - Valida que los filtros sean valores permitidos si se proporcionan
   * - Retorna nombre, apellido, correo, rol, estado y fecha de registro de cada usuario
   * - Las fechas se muestran en hora Colombia (UTC-5)
   * - Ordena los resultados por fecha de registro descendente (mas recientes primero)
   *
   * @param rol - Filtro opcional por rol: ADMIN, CLIENTE, RECEPCIONISTA, VETERINARIO
   * @param estado - Filtro opcional por estado: activo, inactivo, pendiente_verificacion, pendiente_aprobacion, rechazado, suspendido
   * @returns Total de usuarios y lista con sus datos
   */
  async getAllUsers(rol?: string, estado?: string) {
    // Validacion del filtro de rol si se proporciona
    const rolesPermitidos = ['ADMIN', 'CLIENTE', 'RECEPCIONISTA', 'VETERINARIO'];
    if (rol && !rolesPermitidos.includes(rol.toUpperCase())) {
      throw new BadRequestException(
        `Rol no valido. Use: ${rolesPermitidos.join(', ')}`,
      );
    }

    // Validacion del filtro de estado si se proporciona
    const estadosPermitidos = ['activo', 'inactivo', 'pendiente_verificacion', 'pendiente_aprobacion', 'rechazado', 'suspendido'];
    if (estado && !estadosPermitidos.includes(estado.toLowerCase())) {
      throw new BadRequestException(
        `Estado no valido. Use: ${estadosPermitidos.join(', ')}`,
      );
    }

    // Construir query dinamica con filtros opcionales
    const where: any = {};
    if (rol) {
      where.rol = rol.toUpperCase();
    }
    if (estado) {
      where.estado = estado.toLowerCase();
    }

    const usuarios = await this.prisma.usuario.findMany({
      where,
      orderBy: { creado_en: 'desc' },
      select: {
        codigo: true,
        nombre: true,
        apellido: true,
        correo: true,
        rol: true,
        estado: true,
        creado_en: true,
      },
    });

    return {
      total: usuarios.length,
      usuarios: usuarios.map((u) => ({
        codigo: u.codigo,
        nombre: u.nombre,
        apellido: u.apellido,
        correo: u.correo,
        rol: u.rol,
        estado: u.estado,
        creadoEn: formatColombiaDate(u.creado_en),
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
    const usuario = await this.prisma.usuario.findUnique({
      where: { codigo: id },
      select: {
        codigo: true,
        nombre: true,
        apellido: true,
        correo: true,
        rol: true,
        estado: true,
      },
    });

    if (!usuario) {
      throw new NotFoundException('No existe un usuario con ese codigo');
    }

    // Verificar que la cuenta este activa
    if (usuario.estado !== 'activo') {
      throw new BadRequestException(
        `Solo se pueden suspender cuentas activas. Estado actual: ${usuario.estado}`,
      );
    }

    // Suspender la cuenta actualizando el estado a suspendido
    await this.prisma.usuario.update({
      where: { codigo: id },
      data: { estado: 'suspendido' },
    });

    // Emitir evento de auditoria
    this.auditService.emit({
      action: AuditAction.SUSPENSION_USUARIO,
      userId: usuario.codigo,
      userRole: usuario.rol,
      entityType: 'User',
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
    const usuario = await this.prisma.usuario.findUnique({
      where: { codigo: id },
      select: {
        codigo: true,
        nombre: true,
        apellido: true,
        correo: true,
        rol: true,
        estado: true,
      },
    });

    if (!usuario) {
      throw new NotFoundException('No existe un usuario con ese codigo');
    }

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
    await this.prisma.usuario.update({
      where: { codigo: id },
      data: { estado: 'rechazado' },
    });

    // Emitir evento de auditoria
    this.auditService.emit({
      action: AuditAction.RECHAZO_CUENTA,
      userId: usuario.codigo,
      userRole: usuario.rol,
      entityType: 'User',
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
    const usuario = await this.prisma.usuario.findUnique({
      where: { codigo: id },
      select: {
        codigo: true,
        nombre: true,
        apellido: true,
        correo: true,
        rol: true,
        estado: true,
      },
    });

    if (!usuario) {
      throw new NotFoundException('No existe un usuario con ese codigo');
    }

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
    await this.prisma.usuario.update({
      where: { codigo: id },
      data: { estado: 'activo' },
    });

    // Emitir evento de auditoria
    this.auditService.emit({
      action: AuditAction.APROBACION_CUENTA,
      userId: usuario.codigo,
      userRole: usuario.rol,
      entityType: 'User',
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
