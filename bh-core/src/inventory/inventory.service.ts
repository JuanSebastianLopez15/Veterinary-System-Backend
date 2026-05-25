import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/enums/audit-action.enum';
import { ProductType } from './dto/create-product.dto';

const PRODUCT_TYPE_VALUES = Object.values(ProductType) as string[];
const MEDICATION_TYPE = ProductType.MEDICATION;
const EXPIRATION_WINDOW_DAYS = 30;

export interface CreateProductData {
  name: string;
  type: string;
  stock: number;
  minStock: number;
  price: number;
  expirationDate?: string;
}

export interface UpdateProductData {
  name?: string;
  type?: string;
  stock?: number;
  minStock?: number;
  price?: number;
  expirationDate?: string;
}

export interface MappedProduct {
  id: string;
  name: string;
  type: string;
  /** Backwards-compatible alias for {@link type}. */
  category: string;
  stock: number;
  minStock: number;
  price: number;
  expirationDate: string | null;
  createdAt: Date | null;
  isLowStock: boolean;
  isExpiringSoon: boolean;
  /** Backwards-compatible alias for {@link isExpiringSoon}. */
  isNearExpiring: boolean;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private withAlerts(row: any): MappedProduct | null {
    if (!row) return null;

    const stock = row.stock as number;
    const minStock = row.stock_minimo as number;
    const expirationRaw = row.fecha_vencimiento as Date | string | null;

    let expirationDate: Date | null = null;
    if (expirationRaw) {
      expirationDate =
        expirationRaw instanceof Date
          ? expirationRaw
          : new Date(String(expirationRaw));
    }

    const isLowStock = stock <= minStock;

    let isExpiringSoon = false;
    if (expirationDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const limit = new Date(
        today.getTime() + EXPIRATION_WINDOW_DAYS * 24 * 60 * 60 * 1000,
      );
      isExpiringSoon = expirationDate >= today && expirationDate <= limit;
    }

    return {
      id: row.codigo,
      name: row.nombre,
      type: row.tipo,
      category: row.tipo,
      stock,
      minStock,
      price: Number(row.precio),
      expirationDate: expirationDate
        ? expirationDate.toISOString().split('T')[0]
        : null,
      createdAt: row.creado_en ?? null,
      isLowStock,
      isExpiringSoon,
      isNearExpiring: isExpiringSoon,
    };
  }

  private safeAudit(payload: {
    action: AuditAction | string;
    userId: string | null | undefined;
    userRole: string | null | undefined;
    entityType: string;
    entityId?: string;
    details: Record<string, unknown>;
    ipAddress?: string;
  }): void {
    this.auditService
      .emit({
        action: payload.action as string,
        userId: (payload.userId ?? 'system') as string,
        userRole: (payload.userRole ?? 'system') as string,
        entityType: payload.entityType,
        entityId: payload.entityId,
        details: payload.details,
        ipAddress: payload.ipAddress,
      })
      .catch(() => {});
  }

  async createProduct(
    data: CreateProductData,
    actorId?: string,
    actorRole?: string,
    ipAddress?: string,
  ): Promise<MappedProduct> {
    if (data.price < 0) {
      throw new BadRequestException('price debe ser un número no negativo');
    }
    if (data.stock < 0) {
      throw new BadRequestException('stock debe ser un entero no negativo');
    }
    if (data.minStock < 0) {
      throw new BadRequestException('minStock debe ser un entero no negativo');
    }
    if (!PRODUCT_TYPE_VALUES.includes(data.type)) {
      throw new BadRequestException(
        `type debe ser uno de: ${PRODUCT_TYPE_VALUES.join(', ')}`,
      );
    }

    const row = await this.prisma.producto.create({
      data: {
        nombre: data.name,
        tipo: data.type,
        stock: data.stock,
        stock_minimo: data.minStock,
        precio: data.price,
        fecha_vencimiento: data.expirationDate
          ? new Date(data.expirationDate)
          : null,
      },
    });

    const created = this.withAlerts(row) as MappedProduct;

    this.safeAudit({
      action: AuditAction.CREACION_INVENTARIO,
      userId: actorId,
      userRole: actorRole,
      entityType: 'InventoryProduct',
      entityId: created.id,
      details: {
        name: created.name,
        type: created.type,
        stock: created.stock,
        minStock: created.minStock,
        price: created.price,
        expirationDate: created.expirationDate,
      },
      ipAddress,
    });

    return created;
  }

  /** Backwards-compatible alias for {@link createProduct}. */
  async create(
    data: CreateProductData & { category?: string },
    actorId?: string,
    actorRole?: string,
    ipAddress?: string,
  ): Promise<MappedProduct> {
    const type = data.type ?? data.category;
    return this.createProduct(
      { ...data, type: type as string },
      actorId,
      actorRole,
      ipAddress,
    );
  }

  async findAll(type?: string): Promise<{ data: MappedProduct[]; meta: any }> {
    const where: any = {};
    if (type) {
      where.tipo = type;
    }

    const rows = await this.prisma.producto.findMany({
      where,
      orderBy: { nombre: 'asc' },
    });

    const data = rows.map((r) => this.withAlerts(r) as MappedProduct);
    return {
      data,
      meta: { total: data.length, page: 1, limit: data.length || 20, totalPages: 1 },
    };
  }

  async findOne(id: string): Promise<MappedProduct> {
    const row = await this.prisma.producto.findUnique({ where: { codigo: id } });
    const mapped = this.withAlerts(row);
    if (!mapped) {
      throw new NotFoundException('Producto no encontrado');
    }
    return mapped;
  }

  async updateProduct(
    id: string,
    data: UpdateProductData,
    actorId?: string,
    actorRole?: string,
    ipAddress?: string,
  ): Promise<MappedProduct> {
    if (data.price !== undefined && data.price < 0) {
      throw new BadRequestException('price debe ser un número no negativo');
    }
    if (data.minStock !== undefined && data.minStock < 0) {
      throw new BadRequestException('minStock debe ser un entero no negativo');
    }
    if (data.type !== undefined && !PRODUCT_TYPE_VALUES.includes(data.type)) {
      throw new BadRequestException(
        `type debe ser uno de: ${PRODUCT_TYPE_VALUES.join(', ')}`,
      );
    }

    const existing = await this.prisma.producto.findUnique({
      where: { codigo: id },
    });
    if (!existing) {
      throw new NotFoundException('Producto no encontrado');
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.nombre = data.name;
    if (data.type !== undefined) updateData.tipo = data.type;
    if (data.price !== undefined) updateData.precio = data.price;
    if (data.minStock !== undefined) updateData.stock_minimo = data.minStock;
    if (data.expirationDate !== undefined) {
      updateData.fecha_vencimiento = data.expirationDate
        ? new Date(data.expirationDate)
        : null;
    }

    const row = Object.keys(updateData).length
      ? await this.prisma.producto.update({
          where: { codigo: id },
          data: updateData,
        })
      : existing;

    const updated = this.withAlerts(row) as MappedProduct;

    this.safeAudit({
      action: AuditAction.ACTUALIZACION_INVENTARIO,
      userId: actorId,
      userRole: actorRole,
      entityType: 'InventoryProduct',
      entityId: id,
      details: { changes: data },
      ipAddress,
    });

    return updated;
  }

  /** Backwards-compatible alias for {@link updateProduct}. */
  async update(
    id: string,
    data: UpdateProductData,
    actorId?: string,
    actorRole?: string,
    ipAddress?: string,
  ): Promise<MappedProduct | null> {
    try {
      return await this.updateProduct(id, data, actorId, actorRole, ipAddress);
    } catch (err: any) {
      if (err instanceof NotFoundException) return null;
      throw err;
    }
  }

  async adjustStock(
    id: string,
    quantity: number,
    reason?: string,
    actorId?: string,
    actorRole?: string,
    ipAddress?: string,
  ): Promise<MappedProduct> {
    const current = await this.prisma.producto.findUnique({
      where: { codigo: id },
    });
    if (!current) {
      throw new NotFoundException('Producto no encontrado');
    }

    const previousStock = current.stock;
    const newStock = previousStock + quantity;

    if (newStock < 0) {
      throw new BadRequestException(
        `El ajuste resultaría en stock negativo (stock actual: ${previousStock}, ajuste: ${quantity})`,
      );
    }

    const [updatedRow] = await this.prisma.$transaction([
      this.prisma.producto.update({
        where: { codigo: id },
        data: { stock: newStock },
      }),
      this.prisma.movimiento_inventario.create({
        data: {
          producto_codigo: id,
          tipo: 'AJUSTE_MANUAL',
          cantidad: quantity,
          motivo: reason ?? null,
          creado_por: actorId ?? null,
        },
      }),
    ]);

    const updated = this.withAlerts(updatedRow) as MappedProduct;

    this.safeAudit({
      action: AuditAction.AJUSTE_INVENTARIO,
      userId: actorId,
      userRole: actorRole,
      entityType: 'InventoryProduct',
      entityId: id,
      details: {
        productName: current.nombre,
        previousStock,
        newStock: updated.stock,
        adjustment: quantity,
        reason,
      },
      ipAddress,
    });

    return updated;
  }

  async getLowStock(
    type?: string,
  ): Promise<{ data: MappedProduct[]; meta: any }> {
    let rows: any[];
    if (type) {
      rows = await this.prisma.$queryRaw<any[]>`SELECT * FROM producto WHERE stock <= stock_minimo AND tipo = ${type} ORDER BY stock ASC`;
    } else {
      rows = await this.prisma.$queryRaw<any[]>`SELECT * FROM producto WHERE stock <= stock_minimo ORDER BY stock ASC`;
    }

    const data = rows.map((r) => this.withAlerts(r) as MappedProduct);
    return {
      data,
      meta: { total: data.length, page: 1, limit: data.length || 20, totalPages: 1 },
    };
  }

  /** Backwards-compatible alias for {@link getLowStock}. */
  async findLowStock(type?: string) {
    return this.getLowStock(type);
  }

  async getExpiringSoon(
    daysAhead = EXPIRATION_WINDOW_DAYS,
    type?: string,
  ): Promise<{ data: MappedProduct[]; meta: any }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const limit = new Date(today.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const where: any = {
      fecha_vencimiento: {
        not: null,
        gte: today,
        lte: limit,
      },
    };
    if (type) {
      where.tipo = type;
    }

    const rows = await this.prisma.producto.findMany({
      where,
      orderBy: { fecha_vencimiento: 'asc' },
    });

    const data = rows.map((r) => this.withAlerts(r) as MappedProduct);
    return {
      data,
      meta: { total: data.length, page: 1, limit: data.length || 20, totalPages: 1 },
    };
  }

  /** Backwards-compatible alias for {@link getExpiringSoon}. */
  async findExpiring(daysAhead = EXPIRATION_WINDOW_DAYS, type?: string) {
    return this.getExpiringSoon(daysAhead, type);
  }

  async getAlerts(): Promise<{
    lowStock: MappedProduct[];
    expiringSoon: MappedProduct[];
  }> {
    const [lowStock, expiringSoon] = await Promise.all([
      this.getLowStock(),
      this.getExpiringSoon(),
    ]);
    return { lowStock: lowStock.data, expiringSoon: expiringSoon.data };
  }

  /**
   * Deduct stock for a prescribed medication.
   * - If the product cannot be matched by name (case-insensitive) and MEDICATION
   *   type, returns { deducted: false } so the prescription proceeds.
   * - If matched but stock < quantity, throws BadRequestException so the
   *   prescription is rolled back.
   * - Otherwise performs the stock decrement and the movement record in a
   *   single Prisma $transaction and emits a non-blocking audit event.
   */
  async deductForPrescription(
    productName: string,
    quantity: number,
    actorId?: string,
    actorRole?: string,
    ipAddress?: string,
  ): Promise<{ deducted: boolean; productId?: string }> {
    if (!productName || quantity <= 0) {
      return { deducted: false };
    }

    const candidates = await this.prisma.producto.findMany({
      where: {
        tipo: MEDICATION_TYPE,
        nombre: { equals: productName, mode: 'insensitive' as any },
      },
      take: 1,
    });

    const product = candidates[0];
    if (!product) {
      return { deducted: false };
    }

    if (product.stock < quantity) {
      throw new BadRequestException(
        `Stock insuficiente para ${product.nombre} (disponible: ${product.stock}, requerido: ${quantity})`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.producto.update({
        where: { codigo: product.codigo },
        data: { stock: product.stock - quantity },
      }),
      this.prisma.movimiento_inventario.create({
        data: {
          producto_codigo: product.codigo,
          tipo: 'DEDUCCION_PRESCRIPCION',
          cantidad: -quantity,
          motivo: `Prescripción médica`,
          creado_por: actorId ?? null,
        },
      }),
    ]);

    this.safeAudit({
      action: AuditAction.DEDUCCION_STOCK_PRESCRIPCION,
      userId: actorId,
      userRole: actorRole,
      entityType: 'InventoryProduct',
      entityId: product.codigo,
      details: {
        productName: product.nombre,
        previousStock: product.stock,
        newStock: product.stock - quantity,
        deducted: quantity,
      },
      ipAddress,
    });

    return { deducted: true, productId: product.codigo };
  }

  /**
   * Variant of {@link deductForPrescription} that locates the product by its
   * code instead of by name. Same semantics: absent product proceeds without
   * deduction, insufficient stock blocks the prescription.
   */
  async deductForPrescriptionByCode(
    productCode: string,
    quantity: number,
    actorId?: string,
    actorRole?: string,
    ipAddress?: string,
  ): Promise<{ deducted: boolean; productId?: string }> {
    if (!productCode || quantity <= 0) {
      return { deducted: false };
    }

    const product = await this.prisma.producto.findUnique({
      where: { codigo: productCode },
    });

    if (!product) {
      return { deducted: false };
    }

    if (product.stock < quantity) {
      throw new BadRequestException(
        `Stock insuficiente para ${product.nombre} (disponible: ${product.stock}, requerido: ${quantity})`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.producto.update({
        where: { codigo: product.codigo },
        data: { stock: product.stock - quantity },
      }),
      this.prisma.movimiento_inventario.create({
        data: {
          producto_codigo: product.codigo,
          tipo: 'DEDUCCION_PRESCRIPCION',
          cantidad: -quantity,
          motivo: 'Prescripción médica',
          creado_por: actorId ?? null,
        },
      }),
    ]);

    this.safeAudit({
      action: AuditAction.DEDUCCION_STOCK_PRESCRIPCION,
      userId: actorId,
      userRole: actorRole,
      entityType: 'InventoryProduct',
      entityId: product.codigo,
      details: {
        productName: product.nombre,
        previousStock: product.stock,
        newStock: product.stock - quantity,
        deducted: quantity,
      },
      ipAddress,
    });

    return { deducted: true, productId: product.codigo };
  }
}
