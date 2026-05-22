import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard de autenticacion JWT.
 * Protege endpoints que requieren que el usuario este autenticado.
 * Valida el token Bearer del header Authorization.
 * Si el token es invalido o no existe, retorna 401 Unauthorized.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  /**
   * Maneja los errores de autenticacion con un mensaje claro.
   * Se ejecuta cuando el token es invalido, ha expirado o no existe.
   */
  handleRequest(err: any, user: any) {
    if (err || !user) {
      throw new UnauthorizedException('Token invalido o no proporcionado');
    }
    return user;
  }
}
