import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

/**
 * Controlador de autenticacion.
 * Expone los endpoints publicos de registro y verificacion.
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
}
