import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/enums/audit-action.enum';
import { MailService } from '../mail/mail.service';
import { JwtService } from '@nestjs/jwt';
import { formatColombiaDate } from '../common/date.util';

/**
 * Servicio de autenticacion.
 * Gestiona el registro de usuarios y la verificacion de correo.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
  ) {}

  async register(body: any) {
    const { nombre, apellido, correo, contrasena, telefono, rol } = body;

    if (!nombre || !apellido || !correo || !contrasena || !telefono || !rol) {
      throw new BadRequestException('Todos los campos son obligatorios');
    }
    if (/\s/.test(nombre))     throw new BadRequestException('El nombre no puede contener espacios');
    if (/\s/.test(apellido))   throw new BadRequestException('El apellido no puede contener espacios');
    if (/\s/.test(correo))     throw new BadRequestException('El correo no puede contener espacios');
    if (/\s/.test(contrasena)) throw new BadRequestException('La contrasena no puede contener espacios');
    if (/\s/.test(telefono))   throw new BadRequestException('El telefono no puede contener espacios');
    if (/\s/.test(rol))        throw new BadRequestException('El rol no puede contener espacios');

    const regexSoloLetras = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ]+$/;
    if (nombre.length < 3 || nombre.length > 50) {
      throw new BadRequestException('El nombre debe tener entre 3 y 50 caracteres');
    }
    if (!regexSoloLetras.test(nombre)) {
      throw new BadRequestException('El nombre solo puede contener letras. Ejemplo: isabela');
    }

    if (apellido.length < 3 || apellido.length > 50) {
      throw new BadRequestException('El apellido debe tener entre 3 y 50 caracteres');
    }
    if (!regexSoloLetras.test(apellido)) {
      throw new BadRequestException('El apellido solo puede contener letras. Ejemplo: quintero');
    }

    const regexCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regexCorreo.test(correo)) {
      throw new BadRequestException('El correo debe tener un formato valido. Ejemplo: usuario@correo.com');
    }
    if (correo.length > 70) {
      throw new BadRequestException('El correo no puede tener mas de 70 caracteres');
    }

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

    const regexTelefono = /^\d{10}$/;
    if (!regexTelefono.test(telefono)) {
      throw new BadRequestException('El telefono debe tener exactamente 10 digitos');
    }
    if (!telefono.startsWith('3')) {
      throw new BadRequestException('El telefono debe ser un celular colombiano (iniciar con 3)');
    }

    const rolesPermitidos = ['CLIENTE', 'RECEPCIONISTA', 'VETERINARIO'];
    const rolNormalizado = rol.toUpperCase();
    if (!rolesPermitidos.includes(rolNormalizado)) {
      throw new BadRequestException('Rol no valido. Use CLIENTE, RECEPCIONISTA o VETERINARIO');
    }

    const existe = await this.prisma.usuario.findFirst({
      where: { correo: correo.toLowerCase() }
    });
    
    if (existe) {
      throw new ConflictException('Ya existe un usuario con ese correo');
    }

    const contrasenaHasheada = await bcrypt.hash(contrasena, 10);
    const codigoVerificacion = Math.floor(100000 + Math.random() * 900000).toString();
    const codigoExpiracion = new Date(Date.now() + 15 * 60 * 1000);

    const usuario = await this.prisma.usuario.create({
      data: {
        nombre,
        apellido,
        correo: correo.toLowerCase(),
        contrasena: contrasenaHasheada,
        rol: rolNormalizado,
        telefono,
        estado: 'pendiente_verificacion',
        codigo_verificacion: codigoVerificacion,
        codigo_verificacion_expira_en: codigoExpiracion,
      }
    });

    try {
      await this.mailService.sendVerificationCode(usuario.correo, codigoVerificacion);
    } catch {
      console.error(`No se pudo enviar el correo de verificacion a ${usuario.correo}`);
    }

    this.auditService.emit({
      action: AuditAction.REGISTRO_USUARIO,
      userId: usuario.codigo,
      userRole: usuario.rol.toLowerCase(),
      entityType: 'User',
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
      creadoEn: formatColombiaDate(usuario.creado_en),
    };
  }

  async verifyEmail(body: any) {
    const { correo, codigo } = body;

    if (!correo || !codigo) {
      throw new BadRequestException('El correo y el codigo son obligatorios');
    }
    if (/\s/.test(correo)) throw new BadRequestException('El correo no puede contener espacios');
    if (/\s/.test(codigo)) throw new BadRequestException('El codigo no puede contener espacios');

    const regexCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regexCorreo.test(correo)) {
      throw new BadRequestException('El correo debe tener un formato valido. Ejemplo: usuario@correo.com');
    }
    if (correo.length > 70) {
      throw new BadRequestException('El correo no puede tener mas de 70 caracteres');
    }

    const regexCodigo = /^\d{6}$/;
    if (!regexCodigo.test(codigo)) {
      throw new BadRequestException('El codigo debe ser exactamente 6 digitos numericos');
    }

    const usuario = await this.prisma.usuario.findFirst({
      where: { correo: correo.toLowerCase() }
    });

    if (!usuario) {
      throw new NotFoundException('No existe un usuario con ese correo');
    }

    if (usuario.estado === 'activo') {
      throw new BadRequestException('Esta cuenta ya fue verificada anteriormente');
    }
    if (usuario.estado === 'rechazado') {
      throw new BadRequestException('Esta cuenta ha sido rechazada. Contacta al administrador');
    }
    if (usuario.estado === 'suspendido') {
      throw new BadRequestException('Esta cuenta esta suspendida. Contacta al administrador');
    }

    if (!usuario.codigo_verificacion) {
      throw new BadRequestException('No hay un codigo de verificacion activo para esta cuenta');
    }
    if (usuario.codigo_verificacion !== codigo) {
      throw new BadRequestException('El codigo de verificacion es incorrecto');
    }
    if (usuario.codigo_verificacion_expira_en && new Date() > new Date(usuario.codigo_verificacion_expira_en)) {
      throw new BadRequestException('El codigo de verificacion ha expirado. Registrate nuevamente para obtener uno nuevo');
    }

    const rolesConAprobacion = ['RECEPCIONISTA', 'VETERINARIO'];
    const nuevoEstado = rolesConAprobacion.includes(usuario.rol) ? 'pendiente_aprobacion' : 'activo';

    await this.prisma.usuario.update({
      where: { codigo: usuario.codigo },
      data: {
        estado: nuevoEstado,
        codigo_verificacion: null,
        codigo_verificacion_expira_en: null,
      }
    });

    this.auditService.emit({
      action: AuditAction.VERIFICACION_CORREO,
      userId: usuario.codigo,
      userRole: usuario.rol.toLowerCase(),
      entityType: 'User',
      entityId: usuario.codigo,
      details: { correo: usuario.correo, estado: nuevoEstado },
    });

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

  async resendVerification(body: any) {
    const { correo } = body;

    if (!correo) {
      throw new BadRequestException('El correo es obligatorio');
    }
    if (/\s/.test(correo)) {
      throw new BadRequestException('El correo no puede contener espacios');
    }

    const regexCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regexCorreo.test(correo)) {
      throw new BadRequestException('El correo debe tener un formato valido. Ejemplo: usuario@correo.com');
    }
    if (correo.length > 70) {
      throw new BadRequestException('El correo no puede tener mas de 70 caracteres');
    }

    const usuario = await this.prisma.usuario.findFirst({
      where: { correo: correo.toLowerCase() }
    });

    if (!usuario) {
      throw new NotFoundException('No existe un usuario con ese correo');
    }

    if (usuario.estado !== 'pendiente_verificacion') {
      throw new BadRequestException('Solo se puede reenviar el codigo a cuentas pendientes de verificacion');
    }

    const nuevoCodigo = Math.floor(100000 + Math.random() * 900000).toString();
    const nuevaExpiracion = new Date(Date.now() + 15 * 60 * 1000);

    await this.prisma.usuario.update({
      where: { codigo: usuario.codigo },
      data: {
        codigo_verificacion: nuevoCodigo,
        codigo_verificacion_expira_en: nuevaExpiracion,
      }
    });

    try {
      await this.mailService.sendVerificationCode(usuario.correo, nuevoCodigo);
    } catch {
      console.error(`No se pudo reenviar el correo de verificacion a ${usuario.correo}`);
    }
    this.auditService.emit({
      action: AuditAction.REENVIO_CODIGO_VERIFICACION,
      userId: usuario.codigo,
      userRole: usuario.rol.toLowerCase(),
      entityType: 'User',
      entityId: usuario.codigo,
      details: {
        correo: usuario.correo,
      },
    });
    return {
      mensaje: 'Se ha enviado un nuevo codigo de verificacion a tu correo. Expira en 15 minutos.',
    };
  }

  async login(body: any) {
    const { correo, contrasena } = body;

    if (!correo || !contrasena) {
      throw new BadRequestException('El correo y la contrasena son obligatorios');
    }
    if (/\s/.test(correo)) {
      throw new BadRequestException('El correo no puede contener espacios');
    }
    if (/\s/.test(contrasena)) {
      throw new BadRequestException('La contrasena no puede contener espacios');
    }

    const regexCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regexCorreo.test(correo)) {
      throw new BadRequestException('El correo debe tener un formato valido. Ejemplo: usuario@correo.com');
    }
    if (correo.length > 70) {
      throw new BadRequestException('El correo no puede tener mas de 70 caracteres');
    }

    const usuario = await this.prisma.usuario.findFirst({
      where: { correo: correo.toLowerCase() }
    });

    if (!usuario) {
      this.auditService.emit({
        action: AuditAction.LOGIN_FALLIDO,
        userId: null,
        userRole: null,
        entityType: 'User',
        entityId: null,
        details: { correo: correo.toLowerCase(), motivo: 'Usuario no encontrado' },
      });
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    const estadosBloqueados: Record<string, string> = {
      pendiente_verificacion: 'Debes verificar tu correo antes de iniciar sesion',
      pendiente_aprobacion: 'Tu cuenta esta pendiente de aprobacion por el administrador',
      rechazado: 'Tu cuenta ha sido rechazada. Contacta al administrador',
      suspendido: 'Tu cuenta esta suspendida. Contacta al administrador',
      inactivo: 'Tu cuenta esta inactiva. Contacta al administrador',
    };

    if (estadosBloqueados[usuario.estado]) {
      this.auditService.emit({
        action: AuditAction.LOGIN_FALLIDO,
        userId: usuario.codigo,
        userRole: usuario.rol.toLowerCase(),
        entityType: 'User',
        entityId: usuario.codigo,
        details: { correo: usuario.correo, motivo: `Cuenta en estado: ${usuario.estado}` },
      });
      throw new UnauthorizedException(estadosBloqueados[usuario.estado]);
    }

    const contrasenaValida = await bcrypt.compare(contrasena, usuario.contrasena);
    if (!contrasenaValida) {
      this.auditService.emit({
        action: AuditAction.LOGIN_FALLIDO,
        userId: usuario.codigo,
        userRole: usuario.rol.toLowerCase(),
        entityType: 'User',
        entityId: usuario.codigo,
        details: { correo: usuario.correo, motivo: 'Contrasena incorrecta' },
      });
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    const payload = {
      sub: usuario.codigo,
      correo: usuario.correo,
      rol: usuario.rol,
    };
    const token = this.jwtService.sign(payload);

    this.auditService.emit({
      action: AuditAction.LOGIN_EXITOSO,
      userId: usuario.codigo,
      userRole: usuario.rol.toLowerCase(),
      entityType: 'User',
      entityId: usuario.codigo,
      details: { correo: usuario.correo, rol: usuario.rol },
    });

    return {
      accessToken: token,
      codigo: usuario.codigo,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      correo: usuario.correo,
      rol: usuario.rol,
    };
  }
}
