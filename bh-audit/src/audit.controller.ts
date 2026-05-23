import {
    Body,
    Controller,
    HttpCode,
    HttpStatus,
    Post,
} from '@nestjs/common';

import { CreateAuditEventDto } from './dto/create-audit-event.dto';
import { AuditEventService } from './audit-event.service';

/**
 * Controlador encargado de recibir
 * eventos de trazabilidad enviados desde bh-core.
 */
@Controller('api/v1/audit')
export class AuditController {
    constructor(
        private readonly auditEventService: AuditEventService,
    ) {}

    /**
     * Endpoint encargado de registrar
     * eventos de auditoría en la base de datos.
     */
    @Post('events')
    @HttpCode(HttpStatus.CREATED)
    async createAuditEvent(
        @Body() payload: CreateAuditEventDto,
    ) {
        return await this.auditEventService.create(payload);
    }
}