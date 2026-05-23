import {
    Body,
    Controller,
    HttpCode,
    HttpStatus,
    Post,
} from '@nestjs/common';
import { CreateAuditEventDto } from './dto/create-audit-event.dto';
import { AuditEventService } from './audit-event.service';

@Controller('api/v1/audit')
export class AuditController {
    constructor(private readonly auditEventService: AuditEventService) {}

    @Post('events')
    @HttpCode(HttpStatus.CREATED)
    async createAuditEvent(@Body() payload: CreateAuditEventDto) {
        return this.auditEventService.create(payload);
    }
}