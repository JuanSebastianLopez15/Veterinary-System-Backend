import { Controller, Post, Body, Param, Headers, Patch, Get, Query } from '@nestjs/common';
import { HospitalizationService } from './hospitalization.service';
import { CreateHospitalizationDto } from './dto/create-hospitalization.dto';
import { DischargeHospitalizationDto } from './dto/discharge-hospitalization.dto';
import { CreateEvolutionNoteDto } from './dto/create-evolution-note.dto';

@Controller('hospitalization')
export class HospitalizationController {
  constructor(private readonly service: HospitalizationService) {}

  @Post()
  create(
    @Headers('x-veterinario-codigo') veterinarianCode: string,
    @Body() dto: CreateHospitalizationDto,
  ) {
    return this.service.create(dto, veterinarianCode);
  }

  @Patch(':hospitalizacionId/discharge')
  discharge(
    @Param('hospitalizacionId') hospitalizationId: string,
    @Headers('x-veterinario-codigo') veterinarianCode: string,
    @Body() dto: DischargeHospitalizationDto,
  ) {
    return this.service.discharge(hospitalizationId, dto, veterinarianCode);
  }

  @Post(':hospitalizacionId/evolution-notes')
  createEvolutionNote(
    @Param('hospitalizacionId') hospitalizationId: string,
    @Headers('x-veterinario-codigo') veterinarianCode: string,
    @Body() dto: CreateEvolutionNoteDto,
  ) {
    return this.service.createEvolutionNote(hospitalizationId, dto, veterinarianCode);
  }

  @Get(':hospitalizacionId/evolution-notes')
  getEvolutionNotes(
    @Param('hospitalizacionId') hospitalizationId: string,
    @Headers('x-veterinario-codigo') veterinarianCode: string,
    @Headers('x-recepcionista-codigo') recepcionistaCode: string,
  ) {
    // Either veterinarian or recepcionista can access this endpoint
    const userCode = veterinarianCode || recepcionistaCode;
    if (!userCode) {
      throw new Error('Unauthorized');
    }
    return this.service.getEvolutionNotes(hospitalizationId);
  }
}