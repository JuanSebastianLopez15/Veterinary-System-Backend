import { Controller, Post, Body, Param, Req, UseGuards, Patch, Get, UsePipes, ValidationPipe, Query } from '@nestjs/common';
import { MedicalHistoryService } from './medical-history.service';
import { CreateMedicalHistoryDto } from './dto/create-medical-history.dto';
import { EditMedicalHistoryDto } from './dto/edit-medical-history.dto';
import { CreateVaccineDto } from './dto/create-vaccine.dto';
import { UpcomingVaccinesQueryDto } from './dto/upcoming-vaccines-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('appointments')
export class MedicalHistoryController {
  constructor(private readonly service: MedicalHistoryService) {}

  @Post(':citaId/medical-history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('VETERINARIO')
  create(
    @Param('citaId') citaId: string,
    @Body() dto: CreateMedicalHistoryDto,
    @Req() req: any,
  ) {
    return this.service.create(citaId, dto, req.user.codigo);
  }

  @Patch(':citaId/medical-history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('VETERINARIO')
  edit(
    @Param('citaId') citaId: string,
    @Body() dto: EditMedicalHistoryDto,
    @Req() req: any,
  ) {
    return this.service.edit(citaId, dto, req.user.codigo);
  }

  @Get('vaccines/upcoming')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('VETERINARIO', 'RECEPCIONISTA')
  @UsePipes(new ValidationPipe({ transform: true }))
  getUpcomingVaccines(@Query() query: UpcomingVaccinesQueryDto) {
    return this.service.getUpcomingVaccines(query.dias ?? 30);
  }

  @Get(':citaId/pet-history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('VETERINARIO')
  getPetHistoryFromAppointment(
    @Param('citaId') citaId: string,
    @Req() req: any,
  ) {
    return this.service.getPetHistoryFromAppointment(citaId, req.user.codigo);
  }
}

@Controller('medical-history')
@UsePipes(new ValidationPipe({ whitelist: true }))
export class VaccineController {
  constructor(private readonly service: MedicalHistoryService) {}

  @Post(':historialId/vaccines')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('VETERINARIO')
  addVaccine(
    @Param('historialId') historialId: string,
    @Req() req: any,
    @Body() dto: CreateVaccineDto,
  ) {
    return this.service.addVaccine(historialId, dto, req.user.codigo);
  }

  @Get(':historialId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('VETERINARIO', 'RECEPCIONISTA')
  getIndividualHistory(@Param('historialId') historialId: string) {
    return this.service.getIndividualHistory(historialId);
  }
}

@Controller('pets')
export class PetHistoryController {
  constructor(private readonly service: MedicalHistoryService) {}

  @Get(':mascotaId/history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('VETERINARIO', 'RECEPCIONISTA')
  getPetHistory(@Param('mascotaId') mascotaId: string) {
    return this.service.getPetHistory(mascotaId);
  }
}