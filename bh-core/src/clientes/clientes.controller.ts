import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ClientesService } from './clientes.service';

@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Post()
  registrarCliente(@Body() body: any) {
    return this.clientesService.registrarCliente(body);
  }

  @Get()
  consultarClientes() {
    return this.clientesService.consultarClientes();
  }

  @Get('buscar/:nombre')
  consultarClientesPorNombre(@Param('nombre') nombre: string) {
    return this.clientesService.consultarClientesPorNombre(nombre);
  }

  @Get(':id')
  consultarClientePorId(@Param('id') id: string) {
    return this.clientesService.consultarClientePorId(id.trim());// .trim elimina caracteres invisibles
  }

  @Patch(':id')
  actualizarCliente(@Param('id') id: string, @Body() body: any) {
    return this.clientesService.actualizarCliente(id.trim(), body);
  }
}