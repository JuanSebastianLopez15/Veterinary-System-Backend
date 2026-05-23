import { Controller, Post, Body, Param, Patch, Get, UseGuards, Req } from '@nestjs/common';
import { HospitalizationService } from './hospitalization.service';
import { CreateHospitalizationDto } from './dto/create-hospitalization.dto';
import { DischargeHospitalizationDto } from './dto/discharge-hospitalization.dto';
import { CreateEvolutionNoteDto } from './dto/create-evolution-note.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('hospitalization')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HospitalizationController {
  constructor(private readonly service: HospitalizationService) {}

  @Post()
  @Roles('VETERINARIO')
  create(
    @Req() req: any,
    @Body() dto: CreateHospitalizationDto,
  ) {
    return this.service.create(dto, req.user.codigo);
  }

  @Get('active')
  @Roles('VETERINARIO', 'RECEPCIONISTA')
  getActiveHospitalizations() {
    return this.service.getActiveHospitalizations();
  }

  @Patch(':hospitalizacionId/discharge')
  @Roles('VETERINARIO')
  discharge(
    @Param('hospitalizacionId') hospitalizationId: string,
    @Req() req: any,
    @Body() dto: DischargeHospitalizationDto,
  ) {
    return this.service.discharge(hospitalizationId, dto, req.user.codigo);
  }

  @Post(':hospitalizacionId/evolution-notes')
  @Roles('VETERINARIO')
  createEvolutionNote(
    @Param('hospitalizacionId') hospitalizationId: string,
    @Req() req: any,
    @Body() dto: CreateEvolutionNoteDto,
  ) {
    return this.service.createEvolutionNote(hospitalizationId, dto, req.user.codigo);
  }

  @Get(':hospitalizacionId/evolution-notes')
  @Roles('VETERINARIO', 'RECEPCIONISTA')
  getEvolutionNotes(
    @Param('hospitalizacionId') hospitalizationId: string,
  ) {
    return this.service.getEvolutionNotes(hospitalizationId);
  }
}