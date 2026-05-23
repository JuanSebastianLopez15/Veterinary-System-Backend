import { Controller, Post, Body, Param, Req, UseGuards, Patch, Get } from '@nestjs/common';
import { MedicalHistoryService } from './medical-history.service';
import { CreateMedicalHistoryDto } from './dto/create-medical-history.dto';
import { EditMedicalHistoryDto } from './dto/edit-medical-history.dto';
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
  getUpcomingVaccines() {
    return this.service.getUpcomingVaccines();
  }
}