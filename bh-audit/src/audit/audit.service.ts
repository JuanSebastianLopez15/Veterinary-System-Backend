import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAuditEventDto } from './dto/create-audit-event.dto';
import { GetAuditEventsFilterDto } from './dto/get-audit-events-filter.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async createEvent(createDto: CreateAuditEventDto) {
    return this.prisma.auditEvent.create({
      data: {
        action: createDto.action,
        userId: createDto.userId,
        userRole: createDto.userRole,
        entityType: createDto.entityType,
        entityId: createDto.entityId,
        details: createDto.details || {},
        ipAddress: createDto.ipAddress,
        timestamp: new Date(createDto.timestamp),

      },
    });
  }

  async getEvents(filters: GetAuditEventsFilterDto) {
    const { action, userId, userRole, entityType, startDate, endDate, page = 1, limit = 20, sortOrder = 'desc' } = filters;
    
    const where: Prisma.AuditEventWhereInput = {};

    if (action) where.action = action;
    if (userId) where.userId = userId;
    if (userRole) where.userRole = userRole;
    if (entityType) where.entityType = entityType;
    
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [total, data] = await Promise.all([
      this.prisma.auditEvent.count({ where }),
      this.prisma.auditEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: sortOrder },
      })
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      }
    };
  }
}
