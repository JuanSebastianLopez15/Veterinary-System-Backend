import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { DatabaseModule } from '../database/database.module';
import { ServicesController } from './services.controller';
import { ServicesService } from './services.service';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [ServicesController],
  providers: [ServicesService],
  exports: [ServicesService],
})
export class ServicesModule {}
