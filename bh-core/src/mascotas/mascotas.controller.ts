import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { MascotasService } from './mascotas.service';

@Controller('mascotas')
export class MascotasController {
  constructor(private readonly mascotasService: MascotasService) {}

  @Post()
  registrarMascota(@Body() body: any) {
    return this.mascotasService.registrarMascota(body);
  }

  @Get(':id')
  consultarMascotaPorId(@Param('id') id: string) {
    return this.mascotasService.consultarMascotaPorId(id);
  }

  @Patch(':id')
  actualizarMascota(@Param('id') id: string, @Body() body: any) {
    return this.mascotasService.actualizarMascota(id.trim(), body);
  }

  @Patch(':id/peso')
  registrarPeso(@Param('id') id: string, @Body() body: any) {
    return this.mascotasService.registrarPeso(id.trim(), body);
  }

  @Patch(':id/hospitalizar')
  hospitalizarMascota(@Param('id') id: string) {
    return this.mascotasService.hospitalizarMascota(id.trim());
  }

  @Patch(':id/fallecida')
  registrarFallecimiento(@Param('id') id: string) {
    return this.mascotasService.registrarFallecimiento(id.trim());
  }
}