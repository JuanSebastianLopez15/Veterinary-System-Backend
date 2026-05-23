import {
    Body,
    Controller,
    HttpCode,
    HttpStatus,
    Post,
} from '@nestjs/common';
import { CreateAuditEventDto } from './dto/create-audit-event.dto';
import { AuditEventService } from './audit-event.service';

@Controller('audit')
export class AuditController {
    constructor(private readonly auditEventService: AuditEventService) {}

    @Post('events')
    @HttpCode(HttpStatus.CREATED)
    async createAuditEvent(@Body() payload: CreateAuditEventDto) {
        return await this.auditEventService.create(payload);
    }
}