import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  AppointmentsService,
  AuthenticatedUser,
  CancelAppointmentRequest,
  CreateAppointmentRequest,
  CreateClientAppointmentRequest,
  CreatedAppointmentResponse,
  DailyAgendaAppointmentResponse,
  AppointmentStateResponse,
} from './appointments.service';

@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  @Roles('RECEPCIONISTA')
  async createConfirmedAppointment(
    @Req() req: any,
    @Body() body: CreateAppointmentRequest,
  ): Promise<CreatedAppointmentResponse> {
    return this.appointmentsService.createConfirmedAppointment(
      this.getAuthenticatedUser(req),
      body,
    );
  }

  @Post('client')
  @Roles('CLIENTE')
  async createClientAppointment(
    @Req() req: any,
    @Body() body: CreateClientAppointmentRequest,
  ): Promise<CreatedAppointmentResponse> {
    return this.appointmentsService.createClientAppointmentFromAccount(
      this.getAuthenticatedUser(req),
      body,
    );
  }

  @Patch(':codigo/complete')
  @Roles('VETERINARIO')
  async completeAppointment(
    @Param('codigo') codigo: string,
    @Req() req: any,
  ): Promise<AppointmentStateResponse> {
    return this.appointmentsService.completeAppointment(
      codigo,
      this.getAuthenticatedUser(req),
    );
  }

  @Patch(':codigo/cancel')
  @Roles('CLIENTE', 'RECEPCIONISTA', 'VETERINARIO')
  async cancelAppointment(
    @Param('codigo') codigo: string,
    @Req() req: any,
    @Body() body: CancelAppointmentRequest,
  ): Promise<AppointmentStateResponse> {
    return this.appointmentsService.cancelAppointment(
      codigo,
      this.getAuthenticatedUser(req),
      body,
    );
  }

  @Get('availability')
  @Roles('CLIENTE', 'RECEPCIONISTA', 'VETERINARIO')
  async validateAvailability(
    @Query('usuarioCodigo') usuarioCodigo: string,
    @Query('fecha') fecha: string,
    @Query('hora') hora: string,
  ): Promise<{ disponible: boolean }> {
    if (!usuarioCodigo || !fecha || !hora) {
      throw new BadRequestException('usuarioCodigo, fecha y hora son obligatorios');
    }

    const disponible = await this.appointmentsService.isAvailable(
      usuarioCodigo,
      fecha,
      hora,
    );

    return { disponible };
  }

  @Get('daily-agenda')
  @Roles('RECEPCIONISTA', 'VETERINARIO')
  async findDailyAgenda(
    @Req() req: any,
    @Query('veterinarioCodigo') veterinarioCodigo: string,
    @Query('fecha') fecha: string,
  ): Promise<DailyAgendaAppointmentResponse[]> {
    if (!veterinarioCodigo || !fecha) {
      throw new BadRequestException('veterinarioCodigo y fecha son obligatorios');
    }

    return this.appointmentsService.findDailyAgenda(
      this.getAuthenticatedUser(req),
      veterinarioCodigo,
      fecha,
    );
  }

  private getAuthenticatedUser(req: any): AuthenticatedUser {
    return {
      codigo: req.user.codigo,
      rol: req.user.rol,
      ipAddress: req.ip,
    };
  }
}
