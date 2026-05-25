import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Guard de control de acceso por rol.
 * Verifica que el usuario autenticado tenga el rol requerido por el endpoint.
 * Debe usarse siempre despues de JwtAuthGuard.
 * Si el usuario no tiene el rol requerido, retorna 403 Forbidden.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  /**
   * Verifica si el usuario tiene el rol necesario para acceder al endpoint.
   * Si el endpoint no tiene @Roles() definido, permite el acceso.
   *
   * @param context - Contexto de ejecucion del request
   * @returns true si el usuario tiene el rol requerido
   */
  canActivate(context: ExecutionContext): boolean {
    const rolesRequeridos = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Si el endpoint no tiene @Roles(), permite el acceso
    if (!rolesRequeridos || rolesRequeridos.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    // Verificar que el rol del usuario este entre los permitidos
    if (!rolesRequeridos.includes(user?.rol)) {
      throw new ForbiddenException(
        `Acceso denegado. Se requiere uno de los siguientes roles: ${rolesRequeridos.join(', ')}`,
      );
    }

    return true;
  }
}
