import { Body, Controller, Post } from '@nestjs/common';
import { MascotasService } from './mascotas.service';

@Controller('mascotas')
export class MascotasController {
  constructor(private readonly mascotasService: MascotasService) {}

  @Post()
  registrarMascota(@Body() body: any) {
    return this.mascotasService.registrarMascota(body);
  }
}