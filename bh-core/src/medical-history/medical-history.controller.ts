import { Controller, Post, Body, Param, Headers, Patch, Get, Query } from '@nestjs/common';
import { MedicalHistoryService } from './medical-history.service';
import { CreateMedicalHistoryDto } from './dto/create-medical-history.dto';
import { EditMedicalHistoryDto } from './dto/edit-medical-history.dto';
import { CreateVaccineDto } from './dto/create-vaccine.dto';

@Controller('appointments')
export class MedicalHistoryController {
  constructor(private readonly service: MedicalHistoryService) {}

  @Post(':citaId/medical-history')
  create(
    @Param('citaId') citaId: string,
    @Headers('x-veterinario-codigo') veterinarianCode: string,
    @Body() dto: CreateMedicalHistoryDto,
  ) {
    return this.service.create(citaId, dto, veterinarianCode);
  }

  @Patch(':citaId/medical-history')
  edit(
    @Param('citaId') citaId: string,
    @Headers('x-veterinario-codigo') veterinarianCode: string,
    @Body() dto: EditMedicalHistoryDto,
  ) {
    return this.service.edit(citaId, dto, veterinarianCode);
  }

  @Get('vaccines/upcoming')
  getUpcomingVaccines(
    @Headers('x-veterinario-codigo') veterinarianCode: string,
    @Headers('x-recepcionista-codigo') recepcionistaCode: string,
  ) {
    // Either veterinarian or recepcionista can access this endpoint
    const userCode = veterinarianCode || recepcionistaCode;
    if (!userCode) {
      throw new Error('Unauthorized');
    }
    return this.service.getUpcomingVaccines();
  }

  @Post('medical-history/:historialId/vaccines')
  registerVaccine(
    @Param('historialId') historialId: string,
    @Headers('x-veterinario-codigo') veterinarianCode: string,
    @Body() dto: CreateVaccineDto,
  ) {
    return this.service.registerVaccine(historialId, dto, veterinarianCode);
  }
}