import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AuditEvent } from './entities/audit-event.entity';
import { CreateAuditEventDto } from './dto/create-audit-event.dto';
/**
 * Servicio encargado de gestionar
 * la persistencia de eventos de auditoría.
 */
@Injectable()
export class AuditEventService {
    constructor(
        @InjectRepository(AuditEvent)
        private readonly auditRepository: Repository<AuditEvent>,
    ) {}

    /**
     * Guarda un evento de auditoría
     * en la base de datos.
     */
    async create(
        payload: CreateAuditEventDto,
    ): Promise<AuditEvent> {
        const auditEvent = this.auditRepository.create(payload);

        return await this.auditRepository.save(auditEvent);
    }
}