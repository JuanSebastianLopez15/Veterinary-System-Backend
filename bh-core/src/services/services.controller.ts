import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';

import { ServicesService } from './services.service';

@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  async create(@Body() body: Record<string, unknown>, @Req() req: Request) {
    const { name, description, price } = body;

    if (!name || !description || price === undefined) {
      throw new BadRequestException('name, description y price son obligatorios');
    }
    if (typeof name !== 'string' || name.trim() === '') {
      throw new BadRequestException('name debe ser un texto no vacío');
    }
    if (typeof description !== 'string' || description.trim() === '') {
      throw new BadRequestException('description debe ser un texto no vacío');
    }
    if (typeof price !== 'number' || price < 0) {
      throw new BadRequestException('price debe ser un número no negativo');
    }

    return this.servicesService.create(
      { name: name as string, description: description as string, price: price as number },
      req.ip,
    );
  }

  @Get()
  async findAll(@Query('isActive') isActive?: string) {
    if (isActive !== undefined && isActive !== 'true' && isActive !== 'false') {
      throw new BadRequestException('isActive debe ser true o false');
    }
    const filter = isActive === undefined ? undefined : isActive === 'true';
    return this.servicesService.findAll(filter);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const service = await this.servicesService.findOne(id);
    if (!service) throw new NotFoundException('Servicio no encontrado');
    return service;
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    const { name, description, price } = body;

    if (price !== undefined && (typeof price !== 'number' || price < 0)) {
      throw new BadRequestException('price debe ser un número no negativo');
    }

    const service = await this.servicesService.update(
      id,
      {
        name: name as string | undefined,
        description: description as string | undefined,
        price: price as number | undefined,
      },
      req.ip,
    );
    if (!service) throw new NotFoundException('Servicio no encontrado');
    return service;
  }

  @Patch(':id/deactivate')
  async deactivate(@Param('id') id: string, @Req() req: Request) {
    const service = await this.servicesService.deactivate(id, req.ip);
    if (!service) throw new NotFoundException('Servicio no encontrado');
    return service;
  }
}
