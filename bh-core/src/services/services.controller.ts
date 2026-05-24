import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { UpdateServicePriceDto } from './dto/update-service-price.dto';

interface AuthenticatedRequest extends Request {
  user?: { codigo?: string; rol?: string };
}

@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async create(
    @Body() body: CreateServiceDto,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!body?.name || typeof body.name !== 'string' || body.name.trim() === '') {
      throw new BadRequestException('name debe ser un texto no vacío');
    }
    if (body.description !== undefined && typeof body.description !== 'string') {
      throw new BadRequestException('description debe ser un texto');
    }
    if (typeof body.price !== 'number' || body.price < 0) {
      throw new BadRequestException('price debe ser un número no negativo');
    }
    return this.servicesService.createService(
      {
        name: body.name,
        description: body.description,
        price: body.price,
      },
      req.user?.codigo,
      req.user?.rol,
      req.ip,
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Query('isActive') isActive?: string) {
    if (isActive !== undefined && isActive !== 'true' && isActive !== 'false') {
      throw new BadRequestException('isActive debe ser true o false');
    }
    const filter = isActive === undefined ? undefined : isActive === 'true';
    return this.servicesService.findAll(filter);
  }

  @Get('active')
  @UseGuards(JwtAuthGuard)
  async findActive() {
    return this.servicesService.findActive();
  }

  @Get('inactive')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async findInactive() {
    return this.servicesService.findInactive();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    return this.servicesService.findOne(id);
  }

  @Patch(':id/price')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async updatePrice(
    @Param('id') id: string,
    @Body() body: UpdateServicePriceDto,
    @Req() req: AuthenticatedRequest,
  ) {
    if (typeof body?.price !== 'number' || body.price < 0) {
      throw new BadRequestException('price debe ser un número no negativo');
    }
    return this.servicesService.updatePrice(
      id,
      body.price,
      req.user?.codigo,
      req.user?.rol,
      req.ip,
    );
  }

  @Patch(':id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async deactivate(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.servicesService.deactivate(
      id,
      req.user?.codigo,
      req.user?.rol,
      req.ip,
    );
  }

  @Patch(':id/activate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async activate(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.servicesService.activate(
      id,
      req.user?.codigo,
      req.user?.rol,
      req.ip,
    );
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateServiceDto,
    @Req() req: AuthenticatedRequest,
  ) {
    if (body?.name !== undefined && typeof body.name !== 'string') {
      throw new BadRequestException('name debe ser un texto');
    }
    if (
      body?.description !== undefined &&
      typeof body.description !== 'string'
    ) {
      throw new BadRequestException('description debe ser un texto');
    }
    return this.servicesService.updateService(
      id,
      body,
      req.user?.codigo,
      req.user?.rol,
      req.ip,
    );
  }
}
