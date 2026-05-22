import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

/**
 * Controlador de autenticacion.
 * Expone los endpoints publicos de registro, verificacion de correo e inicio de sesion.
 * Ruta base: /api/v1/auth
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Registra un nuevo usuario en el sistema.
   * Roles permitidos: CLIENTE, RECEPCIONISTA, VETERINARIO.
   * El usuario queda en estado pendiente_verificacion hasta confirmar su correo.
   *
   * POST /api/v1/auth/register
   * @param body - { nombre, apellido, correo, contrasena, telefono, rol }
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() body: any) {
    return this.authService.register(body);
  }

  /**
   * Inicia sesion de un usuario activo con correo y contrasena.
   * Retorna un token JWT y los datos basicos del usuario.
   * Solo usuarios con estado activo pueden iniciar sesion.
   *
   * POST /api/v1/auth/login
   * @param body - { correo, contrasena }
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: any) {
    return this.authService.login(body);
  }

  /**
   * Verifica el codigo de 6 digitos enviado al correo del usuario al registrarse.
   * Si el codigo es correcto y no ha expirado, la cuenta pasa a estado activo.
   * El codigo expira a los 15 minutos de haberse generado.
   *
   * POST /api/v1/auth/verify-email
   * @param body - { correo, codigo }
   */
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Body() body: any) {
    return this.authService.verifyEmail(body);
  }

  /**
   * Reenvio de un nuevo codigo de verificacion al correo del usuario.
   * Solo disponible para cuentas en estado pendiente_verificacion.
   * Genera un nuevo codigo de 6 digitos con expiracion de 15 minutos.
   *
   * POST /api/v1/auth/resend-verification
   * @param body - { correo }
   */
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  resendVerification(@Body() body: any) {
    return this.authService.resendVerification(body);
  }
}
