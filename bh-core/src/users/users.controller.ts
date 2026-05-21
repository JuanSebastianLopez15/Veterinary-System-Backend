import { Controller, Get, HttpCode, HttpStatus, Param, Patch } from '@nestjs/common';
import { UsersService } from './users.service';

/**
 * Controlador de gestion de usuarios.
 * Expone los endpoints administrativos para aprobar, rechazar y suspender cuentas.
 * Ruta base: /api/v1/users
 * Nota: estos endpoints requieren rol ADMIN (proteccion JWT se agrega en SCRUM-91)
 */
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Retorna la lista de cuentas de recepcionistas y veterinarios pendientes de aprobacion.
   * Muestra nombre, apellido, correo, rol y fecha de solicitud de cada cuenta.
   *
   * GET /api/v1/users/pending
   */
  @Get('pending')
  @HttpCode(HttpStatus.OK)
  getPendingUsers() {
    return this.usersService.getPendingUsers();
  }

  /**
   * Aprueba la cuenta de un recepcionista o veterinario pendiente de aprobacion.
   * La cuenta debe estar en estado pendiente_aprobacion para poder aprobarse.
   *
   * PATCH /api/v1/users/:id/approve
   * @param id - Codigo UUID del usuario a aprobar
   */
  @Patch(':id/approve')
  @HttpCode(HttpStatus.OK)
  approveUser(@Param('id') id: string) {
    return this.usersService.approveUser(id);
  }
}
