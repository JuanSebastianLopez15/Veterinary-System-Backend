import { Controller, Post, Body, Param, Patch, UseGuards, ParseUUIDPipe, Get, Query, Req, Res} from '@nestjs/common';
import { FacturacionService } from './facturacion.service';
import { CrearFacturaDto } from './dto/crear-factura.dto';
import { AnularFacturaDto } from './dto/anular-factura.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('facturacion')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FacturacionController {
  constructor(private readonly facturacionService: FacturacionService) {}
 
  @Post('generar')
  @Roles('RECEPCIONISTA') // Restricción
  async generar(@Body() crearFacturaDto: CrearFacturaDto, @Req() req: any) {
    return this.facturacionService.generarFactura(crearFacturaDto, req.user?.codigo, req.user?.rol?.toLowerCase());
  }

  @Get('mis-facturas/:id/pdf')
  @Roles('CLIENTE') //acceso para Clientes
  async descargarPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any, 
    @Res() res: any 
  ) {
    const clienteId = req.user.codigo; 

    const pdfBuffer = await this.facturacionService.generarFacturaPdf(id, clienteId);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=factura-${id}.pdf`,
      'Content-Length': pdfBuffer.length,
    });

    res.end(pdfBuffer);
  }

  @Get()
  @Roles('RECEPCIONISTA') // Solo la recepcionista tiene acceso
  async obtenerFacturas(@Query('estado') estado?: string) {
    return this.facturacionService.consultarFacturas(estado);
  }

  @Patch(':id/anular')
  @Roles('RECEPCIONISTA') // Restricción
  async anular(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() anularFacturaDto: AnularFacturaDto,
    @Req() req: any,
  ) {
    return this.facturacionService.anularFactura(id, anularFacturaDto, req.user?.codigo, req.user?.rol?.toLowerCase());
  }

  @Patch(':id/pagar')
  @Roles('RECEPCIONISTA') // Solo la recepcionista puede ejecutarlo
  async pagar(@Param('id', ParseUUIDPipe) id: string) {
    return this.facturacionService.marcarComoPagada(id);
  }
}