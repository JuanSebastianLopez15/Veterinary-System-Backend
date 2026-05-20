import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';

import { AuditService } from '../audit/audit.service';
import { DATABASE_POOL } from '../database/database.provider';

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
    @Inject(DATABASE_POOL) private readonly pool: Pool,
    private readonly auditService: AuditService,
  ) {}

  private mapRow(row: Record<string, unknown>) {
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
      price: typeof row.precio === 'string' ? parseFloat(row.precio) : row.precio,
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
    const result = await this.pool.query<Record<string, unknown>>(
      `INSERT INTO Producto (nombre, tipo, stock, stock_minimo, precio, fecha_vencimiento)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.name,
        data.category,
        data.stock,
        data.minStock,
        data.price,
        data.expirationDate ?? null,
      ],
    );
    return this.mapRow(result.rows[0]);
  }

  async findAll(category?: string) {
    const values: unknown[] = [];
    const where = category ? `WHERE tipo = $${values.push(category)}` : '';
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT * FROM Producto ${where} ORDER BY nombre ASC`,
      values,
    );
    const data = result.rows.map((r) => this.mapRow(r));
    return {
      data,
      meta: { total: data.length, page: 1, limit: data.length || 20, totalPages: 1 },
    };
  }

  async findLowStock(category?: string) {
    const values: unknown[] = [];
    const categoryClause = category ? `AND tipo = $${values.push(category)}` : '';
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT * FROM Producto WHERE stock < stock_minimo ${categoryClause} ORDER BY stock ASC`,
      values,
    );
    const data = result.rows.map((r) => this.mapRow(r));
    return {
      data,
      meta: { total: data.length, page: 1, limit: data.length || 20, totalPages: 1 },
    };
  }

  async findExpiring(daysAhead = 30, category?: string) {
    const values: unknown[] = [daysAhead];
    const categoryClause = category ? `AND tipo = $${values.push(category)}` : '';
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT * FROM Producto
       WHERE fecha_vencimiento IS NOT NULL
         AND fecha_vencimiento >= CURRENT_DATE
         AND fecha_vencimiento <= CURRENT_DATE + ($1 || ' days')::INTERVAL
         ${categoryClause}
       ORDER BY fecha_vencimiento ASC`,
      values,
    );
    const data = result.rows.map((r) => this.mapRow(r));
    return {
      data,
      meta: { total: data.length, page: 1, limit: data.length || 20, totalPages: 1 },
    };
  }

  async findOne(id: string) {
    const result = await this.pool.query<Record<string, unknown>>(
      'SELECT * FROM Producto WHERE codigo = $1',
      [id],
    );
    if (result.rowCount === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async update(id: string, data: UpdateProductData) {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.name !== undefined) {
      fields.push(`nombre = $${idx++}`);
      values.push(data.name);
    }
    if (data.price !== undefined) {
      fields.push(`precio = $${idx++}`);
      values.push(data.price);
    }
    if (data.minStock !== undefined) {
      fields.push(`stock_minimo = $${idx++}`);
      values.push(data.minStock);
    }
    if (data.expirationDate !== undefined) {
      fields.push(`fecha_vencimiento = $${idx++}`);
      values.push(data.expirationDate);
    }

    if (fields.length === 0) {
      return this.findOne(id);
    }

    values.push(id);
    const result = await this.pool.query<Record<string, unknown>>(
      `UPDATE Producto SET ${fields.join(', ')} WHERE codigo = $${idx} RETURNING *`,
      values,
    );
    if (result.rowCount === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async adjustStock(
    id: string,
    quantity: number,
    reason: string,
    ipAddress?: string,
  ) {
    const current = await this.findOne(id);
    if (!current) return null;

    const previousStock = current.stock as number;
    const newStock = previousStock + quantity;

    if (newStock < 0) {
      throw new BadRequestException(
        `El ajuste resultaría en stock negativo (stock actual: ${previousStock}, ajuste: ${quantity})`,
      );
    }

    const result = await this.pool.query<Record<string, unknown>>(
      'UPDATE Producto SET stock = stock + $1 WHERE codigo = $2 RETURNING *',
      [quantity, id],
    );

    if (result.rowCount === 0) throw new NotFoundException('Producto no encontrado');

    const updated = this.mapRow(result.rows[0]);

    this.auditService.emit({
      action: 'AJUSTE_INVENTARIO',
      userId: null,
      userRole: null,
      entityType: 'InventoryProduct',
      entityId: id,
      details: {
        productName: current.name,
        previousStock,
        newStock: updated.stock,
        adjustment: quantity,
        reason,
      },
      ipAddress,
    });

    return updated;
  }
}
