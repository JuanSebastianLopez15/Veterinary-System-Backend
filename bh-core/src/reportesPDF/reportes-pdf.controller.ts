import { Controller, Get, Query, Res, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ReportesPdfService } from './reportes-pdf.service';
import { DateRangeDto } from './dto/date-range.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('reportesPDF')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportesPdfController {
  constructor(private readonly reportesService: ReportesPdfService) {}

  private pipePdfResponse(res: Response, pdfDoc: any, filename: string) {
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=${filename}_${Date.now()}.pdf`,
    });
    pdfDoc.pipe(res);
  }

  @Get('citas')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async getCitasReport(@Query() dto: DateRangeDto, @Res() res: Response) {
    const pdf = await this.reportesService.generarCitasReport(dto);
    this.pipePdfResponse(res, pdf, 'reporte_citas');
  }

  @Get('facturacion')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async getFacturacionReport(@Query() dto: DateRangeDto, @Res() res: Response) {
    const pdf = await this.reportesService.generarFacturacionReport(dto);
    this.pipePdfResponse(res, pdf, 'reporte_facturacion');
  }

  @Get('inventario')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async getInventarioReport(@Res() res: Response) {
    const pdf = await this.reportesService.generarInventarioReport();
    this.pipePdfResponse(res, pdf, 'reporte_inventario');
  }

  @Get('historial')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  async getHistorialReport(@Query() dto: DateRangeDto, @Res() res: Response) {
    const pdf = await this.reportesService.generarHistorialReport(dto);
    this.pipePdfResponse(res, pdf, 'reporte_auditoria');
  }
}