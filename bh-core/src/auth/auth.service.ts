import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import { DATABASE_POOL } from '../database/database.provider';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';

/**
 * Servicio de autenticacion.
 * Gestiona el registro de usuarios con verificacion de correo.
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
}
