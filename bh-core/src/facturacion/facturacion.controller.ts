import { Controller, Post, Body, Param, Patch, UseGuards, ParseUUIDPipe } from '@nestjs/common';
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
  @Roles('RECEPCIONISTA') // Restricción de acceso exclusiva
  async generar(@Body() crearFacturaDto: CrearFacturaDto) {
    return this.facturacionService.generarFactura(crearFacturaDto);
  }

  @Patch(':id/anular')
  @Roles('RECEPCIONISTA') // Restricción de acceso exclusiva
  async anular(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() anularFacturaDto: AnularFacturaDto,
  ) {
    return this.facturacionService.anularFactura(id, anularFacturaDto);
  }

  @Patch(':id/pagar')
  @Roles('RECEPCIONISTA') // Restricción estricta de seguridad: Solo la recepcionista puede ejecutarlo
  async pagar(@Param('id', ParseUUIDPipe) id: string) {
    return this.facturacionService.marcarComoPagada(id);
  }
}