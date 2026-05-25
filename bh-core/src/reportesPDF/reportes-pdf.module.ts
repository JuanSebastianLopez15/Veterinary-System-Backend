import { Module } from '@nestjs/common';
import { ReportesPdfController } from './reportes-pdf.controller';
import { ReportesPdfService } from './reportes-pdf.service';
import { DatabaseModule } from '../database/database.module'; // O la ruta a tu módulo de base de datos

@Module({
  imports: [DatabaseModule],
  controllers: [ReportesPdfController],
  providers: [ReportesPdfService],
})
export class ReportesPdfModule {}