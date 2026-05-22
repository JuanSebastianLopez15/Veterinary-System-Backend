import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

/**
 * Controlador de gestion de usuarios.
 * Expone los endpoints administrativos para consultar, aprobar, rechazar y suspender cuentas.
 * Ruta base: /api/v1/users
 * Todos los endpoints requieren autenticacion JWT y rol ADMIN.
 */
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Retorna el listado completo de usuarios del sistema con filtros opcionales.
   * Permite filtrar por rol y/o estado.
   * Las fechas se muestran en hora Colombia (UTC-5).
   *
   * GET /api/v1/users?rol=CLIENTE&estado=activo
   * @param rol - Filtro opcional: ADMIN, CLIENTE, RECEPCIONISTA, VETERINARIO
   * @param estado - Filtro opcional: activo, inactivo, pendiente_verificacion, pendiente_aprobacion, rechazado, suspendido
   */
  @Get()
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  getAllUsers(
    @Query('rol') rol?: string,
    @Query('estado') estado?: string,
  ) {
    return this.usersService.getAllUsers(rol, estado);
  }

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
   * Suspende la cuenta de un usuario activo.
   * La cuenta debe estar en estado activo para poder suspenderse.
   * El motivo de la suspension es obligatorio (entre 10 y 255 caracteres).
   *
   * PATCH /api/v1/users/:id/suspend
   * @param id - Codigo UUID del usuario a suspender
   * @param body - { motivo }
   */
  @Patch(':id/suspend')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  suspendUser(@Param('id') id: string, @Body() body: any) {
    return this.usersService.suspendUser(id, body);
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
