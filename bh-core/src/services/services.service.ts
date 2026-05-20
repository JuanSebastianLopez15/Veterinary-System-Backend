import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';

import { AuditService } from '../audit/audit.service';
import { DATABASE_POOL } from '../database/database.provider';

interface CreateServiceData {
  name: string;
  description: string;
  price: number;
}

interface UpdateServiceData {
  name?: string;
  description?: string;
  price?: number;
}

@Injectable()
export class ServicesService {
  constructor(
    @Inject(DATABASE_POOL) private readonly pool: Pool,
    private readonly auditService: AuditService,
  ) {}

  private mapRow(row: Record<string, unknown>) {
    return {
      id: row.codigo,
      name: row.nombre,
      description: row.descripcion,
      price: typeof row.precio === 'string' ? parseFloat(row.precio) : row.precio,
      isActive: row.estado === 'activo',
      createdAt: row.creado_en ?? null,
      updatedAt: row.actualizado_en ?? null,
    };
  }

  async create(data: CreateServiceData, ipAddress?: string) {
    const result = await this.pool.query<Record<string, unknown>>(
      `INSERT INTO Servicio (nombre, descripcion, precio)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [data.name, data.description, data.price],
    );
    const created = this.mapRow(result.rows[0]);

    this.auditService.emit({
      action: 'CREACION_SERVICIO',
      userId: null,
      userRole: null,
      entityType: 'Service',
      entityId: created.id as string,
      details: {
        name: created.name,
        description: created.description,
        price: created.price,
      },
      ipAddress,
    });

    return created;
  }

  async findAll() {
    const result = await this.pool.query<Record<string, unknown>>(
      'SELECT * FROM Servicio ORDER BY nombre ASC',
    );
    const data = result.rows.map((r) => this.mapRow(r));
    return {
      data,
      meta: { total: data.length, page: 1, limit: data.length || 20, totalPages: 1 },
    };
  }

  async findOne(id: string) {
    const result = await this.pool.query<Record<string, unknown>>(
      'SELECT * FROM Servicio WHERE codigo = $1',
      [id],
    );
    if (result.rowCount === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async update(id: string, data: UpdateServiceData, ipAddress?: string) {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.name !== undefined) {
      fields.push(`nombre = $${idx++}`);
      values.push(data.name);
    }
    if (data.description !== undefined) {
      fields.push(`descripcion = $${idx++}`);
      values.push(data.description);
    }
    if (data.price !== undefined) {
      fields.push(`precio = $${idx++}`);
      values.push(data.price);
    }

    if (fields.length === 0) return this.findOne(id);

    fields.push(`actualizado_en = now()`);
    values.push(id);

    const result = await this.pool.query<Record<string, unknown>>(
      `UPDATE Servicio SET ${fields.join(', ')} WHERE codigo = $${idx} RETURNING *`,
      values,
    );
    if (result.rowCount === 0) return null;
    const updated = this.mapRow(result.rows[0]);

    this.auditService.emit({
      action: 'EDICION_SERVICIO',
      userId: null,
      userRole: null,
      entityType: 'Service',
      entityId: id,
      details: {
        name: updated.name,
        price: updated.price,
        changes: data,
      },
      ipAddress,
    });

    return updated;
  }

  async deactivate(id: string, ipAddress?: string) {
    const result = await this.pool.query<Record<string, unknown>>(
      `UPDATE Servicio SET estado = 'inactivo', actualizado_en = now()
       WHERE codigo = $1 RETURNING *`,
      [id],
    );
    if (result.rowCount === 0) return null;
    const deactivated = this.mapRow(result.rows[0]);

    this.auditService.emit({
      action: 'DESACTIVACION_SERVICIO',
      userId: null,
      userRole: null,
      entityType: 'Service',
      entityId: id,
      details: { name: deactivated.name },
      ipAddress,
    });

    return deactivated;
  }
}
