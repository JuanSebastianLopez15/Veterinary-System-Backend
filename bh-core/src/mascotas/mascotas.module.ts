import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { MascotasController } from './mascotas.controller';
import { MascotasService } from './mascotas.service';

@Module({
  imports: [DatabaseModule],
  controllers: [MascotasController],
  providers: [MascotasService],
})
export class MascotasModule {}