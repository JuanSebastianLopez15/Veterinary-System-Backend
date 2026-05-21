import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';

const VALID_CATEGORIES = ['medicamento', 'vacuna', 'insumo_quirurgico'] as const;
type Category = (typeof VALID_CATEGORIES)[number];

interface CreateProductData {
  name: string;
  category: Category;
  stock: number;
  minStock: number;
  price: number;
  expirationDate?: string;
}

interface UpdateProductData {
  name?: string;
  price?: number;
  minStock?: number;
  expirationDate?: string;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private mapRow(row: any) {
    if (!row) return null;
    const expirationDate = row.fecha_vencimiento as Date | null;
    const stock = row.stock as number;
    const minStock = row.stock_minimo as number;

    let isNearExpiring = false;
    if (expirationDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const limit = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
      const expDate =
        expirationDate instanceof Date ? expirationDate : new Date(String(expirationDate));
      isNearExpiring = expDate >= today && expDate <= limit;
    }

    return {
      id: row.codigo,
      name: row.nombre,
      category: row.tipo,
      stock,
      minStock,
      price: row.precio,
      expirationDate: expirationDate
        ? expirationDate instanceof Date
          ? expirationDate.toISOString().split('T')[0]
          : String(expirationDate).split('T')[0]
        : null,
      createdAt: row.creado_en ?? null,
      isLowStock: stock < minStock,
      isNearExpiring,
    };
  }

  async create(data: CreateProductData) {
    const row = await this.prisma.producto.create({
      data: {
        nombre: data.name,
        tipo: data.category,
        stock: data.stock,
        stock_minimo: data.minStock,
        precio: data.price,
        fecha_vencimiento: data.expirationDate ? new Date(data.expirationDate) : new Date(),
      },
    });
    return this.mapRow(row);
  }

  async findAll(category?: string) {
    const where: any = {};
    if (category) {
      where.tipo = category;
    }

    const rows = await this.prisma.producto.findMany({
      where,
      orderBy: { nombre: 'asc' },
    });

    const data = rows.map((r) => this.mapRow(r));
    return {
      data,
      meta: { total: data.length, page: 1, limit: data.length || 20, totalPages: 1 },
    };
  }

  async findLowStock(category?: string) {
    let rows;
    if (category) {
      rows = await this.prisma.$queryRaw<any[]>`SELECT * FROM producto WHERE stock < stock_minimo AND tipo = ${category} ORDER BY stock ASC`;
    } else {
      rows = await this.prisma.$queryRaw<any[]>`SELECT * FROM producto WHERE stock < stock_minimo ORDER BY stock ASC`;
    }

    const data = rows.map((r) => this.mapRow(r));
    return {
      data,
      meta: { total: data.length, page: 1, limit: data.length || 20, totalPages: 1 },
    };
  }

  async findExpiring(daysAhead = 30, category?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const limit = new Date(today.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const where: any = {
      fecha_vencimiento: {
        gte: today,
        lte: limit,
      },
    };
    if (category) {
      where.tipo = category;
    }

    const rows = await this.prisma.producto.findMany({
      where,
      orderBy: { fecha_vencimiento: 'asc' },
    });

    const data = rows.map((r) => this.mapRow(r));
    return {
      data,
      meta: { total: data.length, page: 1, limit: data.length || 20, totalPages: 1 },
    };
  }

  async findOne(id: string) {
    const row = await this.prisma.producto.findUnique({
      where: { codigo: id },
    });
    return this.mapRow(row);
  }

  async update(id: string, data: UpdateProductData) {
    if (Object.keys(data).length === 0) {
      return this.findOne(id);
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.nombre = data.name;
    if (data.price !== undefined) updateData.precio = data.price;
    if (data.minStock !== undefined) updateData.stock_minimo = data.minStock;
    if (data.expirationDate !== undefined) updateData.fecha_vencimiento = new Date(data.expirationDate);

    try {
      const row = await this.prisma.producto.update({
        where: { codigo: id },
        data: updateData,
      });
      return this.mapRow(row);
    } catch {
      return null;
    }
  }

  async adjustStock(id: string, quantity: number, reason: string, ipAddress?: string) {
    const current = await this.findOne(id);
    if (!current) throw new NotFoundException('Producto no encontrado');

    const previousStock = current.stock as number;
    const newStock = previousStock + quantity;

    if (newStock < 0) {
      throw new BadRequestException(
        `El ajuste resultaría en stock negativo (stock actual: ${previousStock}, ajuste: ${quantity})`,
      );
    }

    const row = await this.prisma.producto.update({
      where: { codigo: id },
      data: {
        stock: { increment: quantity },
      },
    });

    const updated = this.mapRow(row);

    this.auditService.emit({
      action: 'AJUSTE_INVENTARIO',
      userId: null,
      userRole: null,
      entityType: 'InventoryProduct',
      entityId: id,
      details: {
        productName: current.name,
        previousStock,
        newStock: updated?.stock,
        adjustment: quantity,
        reason,
      },
      ipAddress,
    });

    return updated;
  }
}
