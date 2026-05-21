import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import { DATABASE_POOL } from '../database/database.provider';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';

/**
 * Servicio de autenticacion.
 * Gestiona el registro de usuarios y la verificacion de correo.
 */
@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE_POOL) private readonly pool: Pool,
    private readonly auditService: AuditService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Registra un nuevo usuario en el sistema.
   * - Valida todos los campos obligatorios
   * - Verifica que el correo no este duplicado
   * - Hashea la contrasena con bcrypt
   * - Genera un codigo de verificacion de 6 digitos con expiracion de 15 minutos
   * - Emite evento de auditoria REGISTRO_DE_USUARIO
   *
   * @param body - Datos del formulario de registro
   * @returns Datos del usuario creado (sin contrasena)
   */
  async register(body: any) {
    const { nombre, apellido, correo, contrasena, telefono, rol } = body;

    // Validacion de campos obligatorios
    if (!nombre || !apellido || !correo || !contrasena || !telefono || !rol) {
      throw new BadRequestException('Todos los campos son obligatorios');
    }

    // Validacion: ningun campo puede contener espacios
    if (/\s/.test(nombre))     throw new BadRequestException('El nombre no puede contener espacios');
    if (/\s/.test(apellido))   throw new BadRequestException('El apellido no puede contener espacios');
    if (/\s/.test(correo))     throw new BadRequestException('El correo no puede contener espacios');
    if (/\s/.test(contrasena)) throw new BadRequestException('La contrasena no puede contener espacios');
    if (/\s/.test(telefono))   throw new BadRequestException('El telefono no puede contener espacios');
    if (/\s/.test(rol))        throw new BadRequestException('El rol no puede contener espacios');

    // Validacion de nombre: solo letras (sin numeros, sin simbolos como ***,///,777). Ej: isabela
    const regexSoloLetras = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ]+$/;
    if (nombre.length < 3 || nombre.length > 50) {
      throw new BadRequestException('El nombre debe tener entre 3 y 50 caracteres');
    }
    if (!regexSoloLetras.test(nombre)) {
      throw new BadRequestException('El nombre solo puede contener letras. Ejemplo: isabela');
    }

    // Validacion de apellido: solo letras (sin numeros, sin simbolos como ***,///,777). Ej: quintero
    if (apellido.length < 3 || apellido.length > 50) {
      throw new BadRequestException('El apellido debe tener entre 3 y 50 caracteres');
    }
    if (!regexSoloLetras.test(apellido)) {
      throw new BadRequestException('El apellido solo puede contener letras. Ejemplo: quintero');
    }

    // Validacion de correo: debe contener @, formato valido
    const regexCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regexCorreo.test(correo)) {
      throw new BadRequestException('El correo debe tener un formato valido. Ejemplo: usuario@correo.com');
    }
    if (correo.length > 70) {
      throw new BadRequestException('El correo no puede tener mas de 70 caracteres');
    }

    // Validacion de contrasena: minimo 8, al menos una mayuscula, minuscula y numero
    if (contrasena.length < 8 || contrasena.length > 50) {
      throw new BadRequestException('La contrasena debe tener entre 8 y 50 caracteres');
    }
    if (!/[A-Z]/.test(contrasena)) {
      throw new BadRequestException('La contrasena debe tener al menos una letra mayuscula');
    }
    if (!/[a-z]/.test(contrasena)) {
      throw new BadRequestException('La contrasena debe tener al menos una letra minuscula');
    }
    if (!/[0-9]/.test(contrasena)) {
      throw new BadRequestException('La contrasena debe tener al menos un numero');
    }

    // Validacion de telefono: exactamente 10 digitos, debe iniciar con 3
    const regexTelefono = /^\d{10}$/;
    if (!regexTelefono.test(telefono)) {
      throw new BadRequestException('El telefono debe tener exactamente 10 digitos');
    }
    if (!telefono.startsWith('3')) {
      throw new BadRequestException('El telefono debe ser un celular colombiano (iniciar con 3)');
    }

    // Validacion de rol permitido
    const rolesPermitidos = ['CLIENTE', 'RECEPCIONISTA', 'VETERINARIO'];
    const rolNormalizado = rol.toUpperCase();
    if (!rolesPermitidos.includes(rolNormalizado)) {
      throw new BadRequestException('Rol no valido. Use CLIENTE, RECEPCIONISTA o VETERINARIO');
    }

    // Verificar que el correo no este registrado
    const existe = await this.pool.query(
      `SELECT 1 FROM usuario WHERE correo = $1 LIMIT 1`,
      [correo],
    );
    if (existe.rowCount > 0) {
      throw new ConflictException('Ya existe un usuario con ese correo');
    }

    // Hashear contrasena
    const contrasenaHasheada = await bcrypt.hash(contrasena, 10);

    // Generar codigo de verificacion de 6 digitos con expiracion de 15 minutos
    const codigoVerificacion = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();
    const codigoExpiracion = new Date(Date.now() + 15 * 60 * 1000);

    // Insertar usuario en BD con estado pendiente_verificacion
    const {
      rows: [usuario],
    } = await this.pool.query(
      `INSERT INTO usuario
        (nombre, apellido, correo, contrasena, rol, telefono, estado, codigo_verificacion, codigo_verificacion_expira_en)
       VALUES ($1, $2, $3, $4, $5, $6, 'pendiente_verificacion', $7, $8)
       RETURNING codigo, nombre, apellido, correo, rol, telefono, estado, creado_en`,
      [
        nombre,
        apellido,
        correo.toLowerCase(),
        contrasenaHasheada,
        rolNormalizado,
        telefono,
        codigoVerificacion,
        codigoExpiracion,
      ],
    );

    // Enviar correo con codigo de verificacion (no bloquea el registro si falla)
    try {
      await this.mailService.sendVerificationCode(usuario.correo, codigoVerificacion);
    } catch {
      console.error(`No se pudo enviar el correo de verificacion a ${usuario.correo}`);
    }

    // Emitir evento de auditoria
    this.auditService.emit({
      action: 'REGISTRO_DE_USUARIO',
      userId: usuario.codigo,
      userRole: usuario.rol,
      entityType: 'Usuario',
      entityId: usuario.codigo,
      details: { correo: usuario.correo, rol: usuario.rol },
    });

    return {
      codigo: usuario.codigo,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      correo: usuario.correo,
      rol: usuario.rol,
      estado: usuario.estado,
      creadoEn: usuario.creado_en,
    };
  }

  /**
   * Verifica el codigo de verificacion ingresado por el usuario para activar su cuenta.
   * - Valida que correo y codigo sean obligatorios y sin espacios
   * - Valida formato de correo y longitud maxima de 70 caracteres
   * - Valida que el codigo sea exactamente 6 digitos numericos
   * - Busca el usuario por correo en la base de datos
   * - Verifica que la cuenta no este activa, rechazada ni suspendida
   * - Verifica que haya un codigo activo en BD (caso defensivo)
   * - Verifica que el codigo coincida con el almacenado en BD
   * - Verifica que el codigo no haya expirado (expira a los 15 minutos)
   * - Actualiza el estado segun el rol: CLIENTE -> activo, RECEPCIONISTA/VETERINARIO -> pendiente_aprobacion
   * - Limpia el codigo de verificacion de la BD
   * - Emite evento de auditoria VERIFICACION_CORREO
   *
   * @param body - { correo, codigo }
   * @returns Mensaje de exito y estado de la cuenta
   */
  async verifyEmail(body: any) {
    const { correo, codigo } = body;

    // Validacion de campos obligatorios
    if (!correo || !codigo) {
      throw new BadRequestException('El correo y el codigo son obligatorios');
    }

    // Validacion: ningun campo puede contener espacios
    if (/\s/.test(correo)) throw new BadRequestException('El correo no puede contener espacios');
    if (/\s/.test(codigo)) throw new BadRequestException('El codigo no puede contener espacios');

    // Validacion de formato de correo
    const regexCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regexCorreo.test(correo)) {
      throw new BadRequestException('El correo debe tener un formato valido. Ejemplo: usuario@correo.com');
    }

    // Validacion de longitud maxima del correo
    if (correo.length > 70) {
      throw new BadRequestException('El correo no puede tener mas de 70 caracteres');
    }

    // Validacion del codigo: exactamente 6 digitos numericos
    const regexCodigo = /^\d{6}$/;
    if (!regexCodigo.test(codigo)) {
      throw new BadRequestException('El codigo debe ser exactamente 6 digitos numericos');
    }

    // Buscar usuario por correo
    const { rows } = await this.pool.query(
      `SELECT codigo, correo, rol, estado, codigo_verificacion, codigo_verificacion_expira_en
       FROM usuario WHERE correo = $1 LIMIT 1`,
      [correo.toLowerCase()],
    );

    if (rows.length === 0) {
      throw new NotFoundException('No existe un usuario con ese correo');
    }

    const usuario = rows[0];

    // Verificar el estado actual de la cuenta
    if (usuario.estado === 'activo') {
      throw new BadRequestException('Esta cuenta ya fue verificada anteriormente');
    }
    if (usuario.estado === 'rechazado') {
      throw new BadRequestException('Esta cuenta ha sido rechazada. Contacta al administrador');
    }
    if (usuario.estado === 'suspendido') {
      throw new BadRequestException('Esta cuenta esta suspendida. Contacta al administrador');
    }

    // Verificar que el codigo no sea nulo en BD (caso defensivo)
    if (!usuario.codigo_verificacion) {
      throw new BadRequestException('No hay un codigo de verificacion activo para esta cuenta');
    }

    // Verificar que el codigo coincida con el almacenado en BD
    if (usuario.codigo_verificacion !== codigo) {
      throw new BadRequestException('El codigo de verificacion es incorrecto');
    }

    // Verificar que el codigo no haya expirado
    if (new Date() > new Date(usuario.codigo_verificacion_expira_en)) {
      throw new BadRequestException('El codigo de verificacion ha expirado. Registrate nuevamente para obtener uno nuevo');
    }

    // Determinar nuevo estado segun el rol:
    // CLIENTE -> activo, RECEPCIONISTA o VETERINARIO -> pendiente_aprobacion
    const rolesConAprobacion = ['RECEPCIONISTA', 'VETERINARIO'];
    const nuevoEstado = rolesConAprobacion.includes(usuario.rol)
      ? 'pendiente_aprobacion'
      : 'activo';

    // Actualizar estado y limpiar el codigo de verificacion de la BD
    await this.pool.query(
      `UPDATE usuario
       SET estado = $1, codigo_verificacion = NULL, codigo_verificacion_expira_en = NULL
       WHERE correo = $2`,
      [nuevoEstado, correo.toLowerCase()],
    );

    // Emitir evento de auditoria
    this.auditService.emit({
      action: 'VERIFICACION_CORREO',
      userId: usuario.codigo,
      userRole: usuario.rol,
      entityType: 'Usuario',
      entityId: usuario.codigo,
      details: { correo: usuario.correo, estado: nuevoEstado },
    });

    // Respuesta segun el rol
    if (nuevoEstado === 'pendiente_aprobacion') {
      return {
        mensaje: 'Correo verificado exitosamente. Tu cuenta esta pendiente de aprobacion por el administrador.',
        estado: 'pendiente_aprobacion',
      };
    }

    return {
      mensaje: 'Correo verificado exitosamente. Tu cuenta esta activa.',
      estado: 'activo',
    };
  }

  /**
   * Reenvía un nuevo codigo de verificacion al correo del usuario.
   * - Valida que el correo sea obligatorio, sin espacios y con formato valido
   * - Verifica que el usuario exista y este en estado pendiente_verificacion
   * - Genera un nuevo codigo de 6 digitos con nueva expiracion de 15 minutos
   * - Actualiza el codigo en BD y envia el correo
   * - No emite auditoria (accion de soporte, no de negocio)
   *
   * @param body - { correo }
   * @returns Mensaje de confirmacion de reenvio
   */
  async resendVerification(body: any) {
    const { correo } = body;

    // Validacion de campo obligatorio
    if (!correo) {
      throw new BadRequestException('El correo es obligatorio');
    }

    // Validacion: no puede contener espacios
    if (/\s/.test(correo)) {
      throw new BadRequestException('El correo no puede contener espacios');
    }

    // Validacion de formato de correo
    const regexCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regexCorreo.test(correo)) {
      throw new BadRequestException('El correo debe tener un formato valido. Ejemplo: usuario@correo.com');
    }

    // Validacion de longitud maxima del correo
    if (correo.length > 70) {
      throw new BadRequestException('El correo no puede tener mas de 70 caracteres');
    }

    // Buscar usuario por correo
    const { rows } = await this.pool.query(
      `SELECT codigo, correo, rol, estado FROM usuario WHERE correo = $1 LIMIT 1`,
      [correo.toLowerCase()],
    );

    if (rows.length === 0) {
      throw new NotFoundException('No existe un usuario con ese correo');
    }

    const usuario = rows[0];

    // Solo se puede reenviar si la cuenta esta pendiente de verificacion
    if (usuario.estado !== 'pendiente_verificacion') {
      throw new BadRequestException('Solo se puede reenviar el codigo a cuentas pendientes de verificacion');
    }

    // Generar nuevo codigo de 6 digitos con nueva expiracion de 15 minutos
    const nuevoCodigo = Math.floor(100000 + Math.random() * 900000).toString();
    const nuevaExpiracion = new Date(Date.now() + 15 * 60 * 1000);

    // Actualizar el codigo en BD
    await this.pool.query(
      `UPDATE usuario
       SET codigo_verificacion = $1, codigo_verificacion_expira_en = $2
       WHERE correo = $3`,
      [nuevoCodigo, nuevaExpiracion, correo.toLowerCase()],
    );

    // Enviar nuevo correo con el codigo (no bloquea si falla)
    try {
      await this.mailService.sendVerificationCode(usuario.correo, nuevoCodigo);
    } catch {
      console.error(`No se pudo reenviar el correo de verificacion a ${usuario.correo}`);
    }

    return {
      mensaje: 'Se ha enviado un nuevo codigo de verificacion a tu correo. Expira en 15 minutos.',
    };
  }
}
