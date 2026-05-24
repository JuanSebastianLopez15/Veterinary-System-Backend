import { Controller, Post, Get, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { AuditService } from './audit.service';
import { CreateAuditEventDto } from './dto/create-audit-event.dto';
import { GetAuditEventsFilterDto } from './dto/get-audit-events-filter.dto';

@Controller('audit/events')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createEvent(@Body() createDto: CreateAuditEventDto) {
    return this.auditService.createEvent(createDto);
  }

  @Get()
  async getEvents(@Query() filters: GetAuditEventsFilterDto) {
    return this.auditService.getEvents(filters);
  }
}
