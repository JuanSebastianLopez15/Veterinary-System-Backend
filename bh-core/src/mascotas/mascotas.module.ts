import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { MascotasController } from './mascotas.controller';
import { MascotasService } from './mascotas.service';
import { AuditModule } from '../audit/audit.module';
import { AuditService } from '../audit/audit.service';

/** Módulo de mascotas — agrupa el controlador y el servicio de mascotas */
@Module({
  imports: [DatabaseModule,AuditModule],
  controllers: [MascotasController],
  providers: [MascotasService,AuditService],
})
export class MascotasModule {}