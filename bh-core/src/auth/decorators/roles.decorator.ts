import { SetMetadata } from '@nestjs/common';

/**
 * Clave usada para almacenar los roles requeridos en los metadatos del endpoint.
 */
export const ROLES_KEY = 'roles';

/**
 * Decorador que define los roles permitidos para acceder a un endpoint.
 * Se usa junto con RolesGuard para restringir el acceso por rol.
 *
 * @param roles - Lista de roles permitidos. Ej: @Roles('ADMIN', 'VETERINARIO')
 *
 * @example
 * @Roles('ADMIN')
 * @Get('pending')
 * getPendingUsers() { ... }
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
