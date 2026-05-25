import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { MascotasService } from './mascotas.service';

/**
 * Controlador de mascotas.
 * Maneja las rutas bajo /api/v1/mascotas
 */
@Controller('mascotas')
export class MascotasController {
  constructor(private readonly mascotasService: MascotasService) {}

  /** POST /mascotas — Registra una nueva mascota */
  @Post()
  registrarMascota(@Body() body: any) {
    return this.mascotasService.registrarMascota(body);
  }

  /** GET /mascotas/:id — Devuelve los datos de una mascota por su ID */
  @Get(':id')
  consultarMascotaPorId(@Param('id') id: string) {
    return this.mascotasService.consultarMascotaPorId(id);
  }

  /** PATCH /mascotas/:id — Actualiza los datos de una mascota */
  @Patch(':id')
  actualizarMascota(@Param('id') id: string, @Body() body: any) {
    return this.mascotasService.actualizarMascota(id.trim(), body);
  }

  /** PATCH /mascotas/:id/peso — Actualiza el peso de una mascota */
  @Patch(':id/peso')
  registrarPeso(@Param('id') id: string, @Body() body: any) {
    return this.mascotasService.registrarPeso(id.trim(), body);
  }

  /** PATCH /mascotas/:id/hospitalizar — Cambia el estado de la mascota a hospitalizada */
  @Patch(':id/hospitalizar')
  hospitalizarMascota(@Param('id') id: string) {
    return this.mascotasService.hospitalizarMascota(id.trim());
  }

  /** PATCH /mascotas/:id/fallecida — Registra el fallecimiento de una mascota */
  @Patch(':id/fallecida')
  registrarFallecimiento(@Param('id') id: string) {
    return this.mascotasService.registrarFallecimiento(id.trim());
  }
}