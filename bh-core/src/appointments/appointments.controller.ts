import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';

import {
  AppointmentsService,
  CreateAppointmentRequest,
  CreatedAppointmentResponse,
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
}
