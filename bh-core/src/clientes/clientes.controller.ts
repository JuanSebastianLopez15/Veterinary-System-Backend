import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ClientesService } from './clientes.service';

/**
 * Controlador de clientes.
 * Maneja las rutas bajo /api/v1/clientes
 */
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  /** POST /clientes — Crea un nuevo cliente */
  @Post()
  registrarCliente(@Body() body: any) {
    return this.clientesService.registrarCliente(body);
  }

  /** GET /clientes — Lista todos los clientes */
  @Get()
  consultarClientes() {
    return this.clientesService.consultarClientes();
  }

  /** GET /clientes/buscar/:nombre — Busca clientes por nombre */
  @Get('buscar/:nombre')
  consultarClientesPorNombre(@Param('nombre') nombre: string) {
    return this.clientesService.consultarClientesPorNombre(nombre);
  }

  /** GET /clientes/:id — Devuelve un cliente por su ID */
  @Get(':id')
  consultarClientePorId(@Param('id') id: string) {
    return this.clientesService.consultarClientePorId(id.trim());
  }

  /** PATCH /clientes/:id — Actualiza los datos de un cliente */
  @Patch(':id')
  actualizarCliente(@Param('id') id: string, @Body() body: any) {
    return this.clientesService.actualizarCliente(id.trim(), body);
  }
}