import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';

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
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private mapRow(row: any) {
    if (!row) return null;
    return {
      id: row.codigo,
      name: row.nombre,
      description: row.descripcion,
      price: row.precio,
      isActive: row.estado === 'activo',
      createdAt: row.creado_en ?? null,
      updatedAt: row.actualizado_en ?? null,
    };
  }

  async create(data: CreateServiceData, ipAddress?: string) {
    const row = await this.prisma.servicio.create({
      data: {
        nombre: data.name,
        descripcion: data.description,
        precio: data.price,
        estado: 'activo',
      },
    });
    
    const created = this.mapRow(row);

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

  async findAll(isActive?: boolean) {
    const where: any = {};

    if (isActive === true) {
      where.estado = 'activo';
    } else if (isActive === false) {
      where.estado = 'inactivo';
    }

    const rows = await this.prisma.servicio.findMany({
      where,
      orderBy: { nombre: 'asc' },
    });
    
    const data = rows.map((r) => this.mapRow(r));
    return {
      data,
      meta: { total: data.length, page: 1, limit: data.length || 20, totalPages: 1 },
    };
  }

  async findOne(id: string) {
    const row = await this.prisma.servicio.findUnique({
      where: { codigo: id },
    });
    if (!row) return null;
    return this.mapRow(row);
  }

  async update(id: string, data: UpdateServiceData, ipAddress?: string) {
    if (Object.keys(data).length === 0) return this.findOne(id);

    const updateData: any = { actualizado_en: new Date() };
    if (data.name !== undefined) updateData.nombre = data.name;
    if (data.description !== undefined) updateData.descripcion = data.description;
    if (data.price !== undefined) updateData.precio = data.price;

    try {
      const row = await this.prisma.servicio.update({
        where: { codigo: id },
        data: updateData,
      });
      
      const updated = this.mapRow(row);

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
    } catch (e) {
      return null;
    }
  }

  async deactivate(id: string, ipAddress?: string) {
    try {
      const row = await this.prisma.servicio.update({
        where: { codigo: id },
        data: {
          estado: 'inactivo',
          actualizado_en: new Date(),
        },
      });
      
      const deactivated = this.mapRow(row);

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
    } catch (e) {
      return null;
    }
  }
}
