import { Body, Controller, Post } from '@nestjs/common';
import { ClientesService } from './clientes.service';

@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Post()
  registrarCliente(@Body() body: any) {
    return this.clientesService.registrarCliente(body);
  }
}