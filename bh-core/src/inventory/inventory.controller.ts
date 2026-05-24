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
import { InventoryService } from './inventory.service';
import {
  CreateProductDto,
  ProductType,
} from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';

const VALID_TYPES = Object.values(ProductType) as string[];

interface AuthenticatedRequest extends Request {
  user?: { codigo?: string; rol?: string };
}

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('products')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async createProduct(
    @Body() body: CreateProductDto,
    @Req() req: AuthenticatedRequest,
  ) {
    this.validateCreatePayload(body);
    return this.inventoryService.createProduct(
      {
        name: body.name,
        type: body.type,
        stock: body.stock,
        minStock: body.minStock,
        price: body.price,
        expirationDate: body.expirationDate,
      },
      req.user?.codigo,
      req.user?.rol,
      req.ip,
    );
  }

  // Legacy alias kept for backwards compatibility with the previous controller
  // contract (POST /inventory). New consumers MUST use POST /inventory/products.
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async createLegacy(
    @Body() body: Record<string, any>,
    @Req() req: AuthenticatedRequest,
  ) {
    const type = (body.type ?? body.category) as string | undefined;
    const payload: CreateProductDto = {
      name: body.name,
      type: type as ProductType,
      stock: body.stock,
      minStock: body.minStock,
      price: body.price,
      expirationDate: body.expirationDate,
    };
    this.validateCreatePayload(payload);
    return this.inventoryService.createProduct(
      payload,
      req.user?.codigo,
      req.user?.rol,
      req.ip,
    );
  }

  @Get('products')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async listProducts(@Query('type') type?: string) {
    this.validateOptionalType(type);
    return this.inventoryService.findAll(type);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async findAll(
    @Query('type') type?: string,
    @Query('category') category?: string,
  ) {
    const effective = type ?? category;
    this.validateOptionalType(effective);
    return this.inventoryService.findAll(effective);
  }

  @Get('low-stock')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getLowStock(@Query('type') type?: string) {
    this.validateOptionalType(type);
    return this.inventoryService.getLowStock(type);
  }

  @Get('expiring')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getExpiring(@Query('type') type?: string) {
    this.validateOptionalType(type);
    return this.inventoryService.getExpiringSoon(30, type);
  }

  @Get('alerts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getAlerts() {
    return this.inventoryService.getAlerts();
  }

  @Get('products/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async findProduct(@Param('id') id: string) {
    return this.inventoryService.findOne(id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async findOne(@Param('id') id: string) {
    return this.inventoryService.findOne(id);
  }

  @Patch('products/:id/stock')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async adjustStockNew(
    @Param('id') id: string,
    @Body() body: AdjustStockDto,
    @Req() req: AuthenticatedRequest,
  ) {
    this.validateAdjustStockPayload(body);
    return this.inventoryService.adjustStock(
      id,
      body.quantity,
      body.reason,
      req.user?.codigo,
      req.user?.rol,
      req.ip,
    );
  }

  @Patch('products/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async updateProduct(
    @Param('id') id: string,
    @Body() body: UpdateProductDto,
    @Req() req: AuthenticatedRequest,
  ) {
    this.validateUpdatePayload(body);
    return this.inventoryService.updateProduct(
      id,
      body,
      req.user?.codigo,
      req.user?.rol,
      req.ip,
    );
  }

  @Patch(':id/adjust-stock')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async adjustStockLegacy(
    @Param('id') id: string,
    @Body() body: AdjustStockDto,
    @Req() req: AuthenticatedRequest,
  ) {
    this.validateAdjustStockPayload(body);
    return this.inventoryService.adjustStock(
      id,
      body.quantity,
      body.reason,
      req.user?.codigo,
      req.user?.rol,
      req.ip,
    );
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async updateLegacy(
    @Param('id') id: string,
    @Body() body: UpdateProductDto,
    @Req() req: AuthenticatedRequest,
  ) {
    this.validateUpdatePayload(body);
    return this.inventoryService.updateProduct(
      id,
      body,
      req.user?.codigo,
      req.user?.rol,
      req.ip,
    );
  }

  private validateOptionalType(type?: string) {
    if (type !== undefined && !VALID_TYPES.includes(type)) {
      throw new BadRequestException(
        `type debe ser uno de: ${VALID_TYPES.join(', ')}`,
      );
    }
  }

  private validateCreatePayload(body: CreateProductDto) {
    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      throw new BadRequestException('name debe ser un texto no vacío');
    }
    if (!VALID_TYPES.includes(body.type)) {
      throw new BadRequestException(
        `type debe ser uno de: ${VALID_TYPES.join(', ')}`,
      );
    }
    if (
      typeof body.stock !== 'number' ||
      !Number.isInteger(body.stock) ||
      body.stock < 0
    ) {
      throw new BadRequestException('stock debe ser un entero no negativo');
    }
    if (
      typeof body.minStock !== 'number' ||
      !Number.isInteger(body.minStock) ||
      body.minStock < 0
    ) {
      throw new BadRequestException('minStock debe ser un entero no negativo');
    }
    if (typeof body.price !== 'number' || body.price < 0) {
      throw new BadRequestException('price debe ser un número no negativo');
    }
  }

  private validateUpdatePayload(body: UpdateProductDto) {
    if (
      body.price !== undefined &&
      (typeof body.price !== 'number' || body.price < 0)
    ) {
      throw new BadRequestException('price debe ser un número no negativo');
    }
    if (
      body.minStock !== undefined &&
      (typeof body.minStock !== 'number' ||
        !Number.isInteger(body.minStock) ||
        body.minStock < 0)
    ) {
      throw new BadRequestException('minStock debe ser un entero no negativo');
    }
    if (body.type !== undefined && !VALID_TYPES.includes(body.type)) {
      throw new BadRequestException(
        `type debe ser uno de: ${VALID_TYPES.join(', ')}`,
      );
    }
  }

  private validateAdjustStockPayload(body: AdjustStockDto) {
    if (
      body?.quantity === undefined ||
      typeof body.quantity !== 'number' ||
      !Number.isInteger(body.quantity)
    ) {
      throw new BadRequestException('quantity debe ser un número entero');
    }
    if (body.reason !== undefined && typeof body.reason !== 'string') {
      throw new BadRequestException('reason debe ser un texto');
    }
  }
}
