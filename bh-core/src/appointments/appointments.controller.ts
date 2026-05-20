import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
} from '@nestjs/common';

import {
  AppointmentsService,
  CreateAppointmentRequest,
  CreateClientAppointmentRequest,
  CreatedAppointmentResponse,
  DailyAgendaAppointmentResponse,
} from './appointments.service';

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  async createConfirmedAppointment(
    @Body() body: CreateAppointmentRequest,
  ): Promise<CreatedAppointmentResponse> {
    return this.appointmentsService.createConfirmedAppointment(body);
  }

  @Post('client')
  async createClientAppointment(
    @Headers('x-user-code') authenticatedUserCode: string | undefined,
    @Body() body: CreateClientAppointmentRequest,
  ): Promise<CreatedAppointmentResponse> {
    return this.appointmentsService.createClientAppointmentFromAccount(
      authenticatedUserCode,
      body,
    );
  }

  @Get('availability')
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
  async findDailyAgenda(
    @Query('veterinarioCodigo') veterinarioCodigo: string,
    @Query('fecha') fecha: string,
  ): Promise<DailyAgendaAppointmentResponse[]> {
    if (!veterinarioCodigo || !fecha) {
      throw new BadRequestException('veterinarioCodigo y fecha son obligatorios');
    }

    return this.appointmentsService.findDailyAgenda(veterinarioCodigo, fecha);
  }
}
