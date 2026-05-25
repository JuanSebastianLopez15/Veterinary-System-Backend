import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/enums/audit-action.enum';

export interface CreateServiceData {
  name: string;
  description?: string;
  price: number;
}

export interface UpdateServiceData {
  name?: string;
  description?: string;
}

export interface MappedService {
  id: string;
  name: string;
  description: string | null;
  price: number;
  isActive: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private mapRow(row: any): MappedService | null {
    if (!row) return null;
    return {
      id: row.codigo,
      name: row.nombre,
      description: row.descripcion ?? null,
      price: Number(row.precio),
      isActive: row.estado === 'activo',
      createdAt: row.creado_en ?? null,
      updatedAt: row.actualizado_en ?? null,
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

  async createService(
    data: CreateServiceData,
    actorId?: string,
    actorRole?: string,
    ipAddress?: string,
  ): Promise<MappedService> {
    if (data.price < 0) {
      throw new BadRequestException('price debe ser un número no negativo');
    }
    const row = await this.prisma.servicio.create({
      data: {
        nombre: data.name,
        descripcion: data.description ?? '',
        precio: data.price,
        estado: 'activo',
      },
    });

    const created = this.mapRow(row) as MappedService;

    this.safeAudit({
      action: AuditAction.CREACION_SERVICIO,
      userId: actorId,
      userRole: actorRole,
      entityType: 'Service',
      entityId: created.id,
      details: {
        name: created.name,
        description: created.description,
        price: created.price,
      },
      ipAddress,
    });

    return created;
  }

  /** Backwards-compatible alias. */
  async create(
    data: CreateServiceData & { description: string },
    ipAddress?: string,
  ): Promise<MappedService> {
    return this.createService(data, undefined, undefined, ipAddress);
  }

  async findAll(isActive?: boolean): Promise<{ data: MappedService[]; meta: any }> {
    const where: any = {};
    if (isActive === true) where.estado = 'activo';
    else if (isActive === false) where.estado = 'inactivo';

    const rows = await this.prisma.servicio.findMany({
      where,
      orderBy: { creado_en: 'desc' },
    });

    const data = rows.map((r) => this.mapRow(r) as MappedService);
    return {
      data,
      meta: {
        total: data.length,
        page: 1,
        limit: data.length || 20,
        totalPages: 1,
      },
    };
  }

  async findActive(): Promise<MappedService[]> {
    const rows = await this.prisma.servicio.findMany({
      where: { estado: 'activo' },
      orderBy: { creado_en: 'desc' },
    });
    return rows.map((r) => this.mapRow(r) as MappedService);
  }

  async findInactive(): Promise<MappedService[]> {
    const rows = await this.prisma.servicio.findMany({
      where: { estado: 'inactivo' },
      orderBy: { creado_en: 'desc' },
    });
    return rows.map((r) => this.mapRow(r) as MappedService);
  }

  async findOne(id: string): Promise<MappedService> {
    const row = await this.prisma.servicio.findUnique({
      where: { codigo: id },
    });
    const mapped = this.mapRow(row);
    if (!mapped) {
      throw new NotFoundException('Servicio no encontrado');
    }
    return mapped;
  }

  async updateService(
    id: string,
    data: UpdateServiceData,
    actorId?: string,
    actorRole?: string,
    ipAddress?: string,
  ): Promise<MappedService> {
    const existing = await this.prisma.servicio.findUnique({
      where: { codigo: id },
    });
    if (!existing) {
      throw new NotFoundException('Servicio no encontrado');
    }

    const updateData: any = { actualizado_en: new Date() };
    if (data.name !== undefined) updateData.nombre = data.name;
    if (data.description !== undefined) updateData.descripcion = data.description;

    const row = await this.prisma.servicio.update({
      where: { codigo: id },
      data: updateData,
    });

    const updated = this.mapRow(row) as MappedService;

    this.safeAudit({
      action: AuditAction.EDICION_SERVICIO,
      userId: actorId,
      userRole: actorRole,
      entityType: 'Service',
      entityId: id,
      details: { changes: data },
      ipAddress,
    });

    return updated;
  }

  /** Backwards-compatible alias accepting price too (legacy contract). */
  async update(
    id: string,
    data: UpdateServiceData & { price?: number },
    ipAddress?: string,
  ): Promise<MappedService | null> {
    try {
      let updated = await this.updateService(
        id,
        { name: data.name, description: data.description },
        undefined,
        undefined,
        ipAddress,
      );
      if (data.price !== undefined) {
        updated = await this.updatePrice(
          id,
          data.price,
          undefined,
          undefined,
          ipAddress,
        );
      }
      return updated;
    } catch (err: any) {
      if (err instanceof NotFoundException) return null;
      throw err;
    }
  }

  async updatePrice(
    id: string,
    price: number,
    actorId?: string,
    actorRole?: string,
    ipAddress?: string,
  ): Promise<MappedService> {
    if (price < 0) {
      throw new BadRequestException('price debe ser un número no negativo');
    }
    const existing = await this.prisma.servicio.findUnique({
      where: { codigo: id },
    });
    if (!existing) {
      throw new NotFoundException('Servicio no encontrado');
    }

    const previousPrice = Number(existing.precio);

    const row = await this.prisma.servicio.update({
      where: { codigo: id },
      data: { precio: price, actualizado_en: new Date() },
    });

    const updated = this.mapRow(row) as MappedService;

    this.safeAudit({
      action: AuditAction.ACTUALIZACION_PRECIO_SERVICIO,
      userId: actorId,
      userRole: actorRole,
      entityType: 'Service',
      entityId: id,
      details: {
        name: updated.name,
        previousPrice,
        newPrice: updated.price,
      },
      ipAddress,
    });

    return updated;
  }

  async deactivate(
    id: string,
    actorId?: string,
    actorRole?: string,
    ipAddress?: string,
  ): Promise<MappedService> {
    const existing = await this.prisma.servicio.findUnique({
      where: { codigo: id },
    });
    if (!existing) {
      throw new NotFoundException('Servicio no encontrado');
    }
    if (existing.estado === 'inactivo') {
      throw new BadRequestException('El servicio ya está inactivo');
    }

    const row = await this.prisma.servicio.update({
      where: { codigo: id },
      data: { estado: 'inactivo', actualizado_en: new Date() },
    });

    const deactivated = this.mapRow(row) as MappedService;

    this.safeAudit({
      action: AuditAction.DESACTIVACION_SERVICIO,
      userId: actorId,
      userRole: actorRole,
      entityType: 'Service',
      entityId: id,
      details: { name: deactivated.name },
      ipAddress,
    });

    return deactivated;
  }

  async activate(
    id: string,
    actorId?: string,
    actorRole?: string,
    ipAddress?: string,
  ): Promise<MappedService> {
    const existing = await this.prisma.servicio.findUnique({
      where: { codigo: id },
    });
    if (!existing) {
      throw new NotFoundException('Servicio no encontrado');
    }
    if (existing.estado === 'activo') {
      throw new BadRequestException('El servicio ya está activo');
    }

    const row = await this.prisma.servicio.update({
      where: { codigo: id },
      data: { estado: 'activo', actualizado_en: new Date() },
    });

    const activated = this.mapRow(row) as MappedService;

    this.safeAudit({
      action: AuditAction.ACTIVACION_SERVICIO,
      userId: actorId,
      userRole: actorRole,
      entityType: 'Service',
      entityId: id,
      details: { name: activated.name },
      ipAddress,
    });

    return activated;
  }
}

/** Alias exposed under the spec's preferred name. */
export { ServicesService as CatalogService };
