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
  async generar(@Body() crearFacturaDto: CrearFacturaDto) {
    return this.facturacionService.generarFactura(crearFacturaDto);
  }

  @Get()
  @Roles('RECEPCIONISTA') // Solo la recepcionista tiene acceso
  async obtenerFacturas(@Query('estado') estado?: string) {
    return this.facturacionService.consultarFacturas(estado);
  }

  @Get('mis-facturas/:id/pdf')
  @Roles('CLIENTE') // Restricción de acceso estricta para Clientes
  async descargarPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any, // Captura la petición para extraer el ID del cliente autenticado
    @Res() res: any  // Captura la respuesta nativa para enviar el flujo del archivo
  ) {
    const clienteId = req.user.codigo; 

    const pdfBuffer = await this.facturacionService.generarFacturaPdf(id, clienteId);

    // Configuracion las cabeceras HTTP para que el navegador descargue el archivo automáticamente
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=factura-${id}.pdf`,
      'Content-Length': pdfBuffer.length,
    });

    // archivo binario
    res.end(pdfBuffer);
  }

  @Patch(':id/anular')
  @Roles('RECEPCIONISTA') // Restricción
  async anular(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() anularFacturaDto: AnularFacturaDto,
  ) {
    return this.facturacionService.anularFactura(id, anularFacturaDto);
  }

  @Patch(':id/pagar')
  @Roles('RECEPCIONISTA') // Solo la recepcionista puede ejecutarlo
  async pagar(@Param('id', ParseUUIDPipe) id: string) {
    return this.facturacionService.marcarComoPagada(id);
  }
}