import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';

import { InventoryService } from './inventory.service';

const VALID_CATEGORIES = ['medicamento', 'vacuna', 'insumo_quirurgico'];

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post()
  async create(@Body() body: Record<string, unknown>) {
    const { name, category, stock, minStock, price, expirationDate } = body;

    if (!name || !category || stock === undefined || minStock === undefined || price === undefined) {
      throw new BadRequestException('name, category, stock, minStock y price son obligatorios');
    }
    if (typeof name !== 'string' || name.trim() === '') {
      throw new BadRequestException('name debe ser un texto no vacío');
    }
    if (!VALID_CATEGORIES.includes(category as string)) {
      throw new BadRequestException(
        `category debe ser uno de: ${VALID_CATEGORIES.join(', ')}`,
      );
    }
    if (typeof stock !== 'number' || !Number.isInteger(stock) || stock < 0) {
      throw new BadRequestException('stock debe ser un entero no negativo');
    }
    if (typeof minStock !== 'number' || !Number.isInteger(minStock) || minStock < 0) {
      throw new BadRequestException('minStock debe ser un entero no negativo');
    }
    if (typeof price !== 'number' || price < 0) {
      throw new BadRequestException('price debe ser un número no negativo');
    }

    return this.inventoryService.create({
      name: name as string,
      category: category as 'medicamento' | 'vacuna' | 'insumo_quirurgico',
      stock: stock as number,
      minStock: minStock as number,
      price: price as number,
      expirationDate: expirationDate as string | undefined,
    });
  }

  // These static routes MUST be declared before `:id` to avoid NestJS routing conflicts
  @Get('low-stock')
  async getLowStock() {
    return this.inventoryService.findLowStock();
  }

  @Get('expiring')
  async getExpiring() {
    return this.inventoryService.findExpiring();
  }

  @Get()
  async findAll() {
    return this.inventoryService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const product = await this.inventoryService.findOne(id);
    if (!product) throw new NotFoundException('Producto no encontrado');
    return product;
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const { name, price, minStock, expirationDate } = body;

    if (price !== undefined && (typeof price !== 'number' || price < 0)) {
      throw new BadRequestException('price debe ser un número no negativo');
    }
    if (
      minStock !== undefined &&
      (typeof minStock !== 'number' || !Number.isInteger(minStock) || minStock < 0)
    ) {
      throw new BadRequestException('minStock debe ser un entero no negativo');
    }

    const product = await this.inventoryService.update(id, {
      name: name as string | undefined,
      price: price as number | undefined,
      minStock: minStock as number | undefined,
      expirationDate: expirationDate as string | undefined,
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    return product;
  }

  @Patch(':id/adjust-stock')
  async adjustStock(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    const { quantity, reason } = body;

    if (quantity === undefined || reason === undefined) {
      throw new BadRequestException('quantity y reason son obligatorios');
    }
    if (typeof quantity !== 'number' || !Number.isInteger(quantity)) {
      throw new BadRequestException('quantity debe ser un número entero');
    }
    if (typeof reason !== 'string' || reason.trim() === '') {
      throw new BadRequestException('reason debe ser un texto no vacío');
    }

    const product = await this.inventoryService.adjustStock(
      id,
      quantity as number,
      reason as string,
      req.ip,
    );
    if (!product) throw new NotFoundException('Producto no encontrado');
    return product;
  }
}
