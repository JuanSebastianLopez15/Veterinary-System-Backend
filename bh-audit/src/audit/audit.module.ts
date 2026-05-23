import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditController } from './audit.controller';
import { AuditEventService } from './audit-event.service';
import { AuditEvent } from './entities/audit-event.entity';

/**
 * Módulo encargado de gestionar
 * la trazabilidad del sistema.
 */
@Module({
    imports: [TypeOrmModule.forFeature([AuditEvent])],
    controllers: [AuditController],
    providers: [AuditEventService],
})
export class AuditModule {}