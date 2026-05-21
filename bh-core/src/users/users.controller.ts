import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

/**
 * Controlador de gestion de usuarios.
 * Expone los endpoints administrativos para aprobar, rechazar y suspender cuentas.
 * Ruta base: /api/v1/users
 * Todos los endpoints requieren autenticacion JWT y rol ADMIN.
 */
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Retorna la lista de cuentas de recepcionistas y veterinarios pendientes de aprobacion.
   * Muestra nombre, apellido, correo, rol y fecha de solicitud de cada cuenta.
   *
   * GET /api/v1/users/pending
   */
  @Get('pending')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  getPendingUsers() {
    return this.usersService.getPendingUsers();
  }

  /**
   * Rechaza la cuenta de un recepcionista o veterinario pendiente de aprobacion.
   * La cuenta debe estar en estado pendiente_aprobacion para poder rechazarse.
   * El motivo del rechazo es obligatorio (entre 10 y 255 caracteres).
   *
   * PATCH /api/v1/users/:id/reject
   * @param id - Codigo UUID del usuario a rechazar
   * @param body - { motivo }
   */
  @Patch(':id/reject')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  rejectUser(@Param('id') id: string, @Body() body: any) {
    return this.usersService.rejectUser(id, body);
  }

  /**
   * Aprueba la cuenta de un recepcionista o veterinario pendiente de aprobacion.
   * La cuenta debe estar en estado pendiente_aprobacion para poder aprobarse.
   *
   * PATCH /api/v1/users/:id/approve
   * @param id - Codigo UUID del usuario a aprobar
   */
  @Patch(':id/approve')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  approveUser(@Param('id') id: string) {
    return this.usersService.approveUser(id);
  }
}
