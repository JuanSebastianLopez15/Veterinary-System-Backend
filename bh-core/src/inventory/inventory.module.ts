import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { DatabaseModule } from '../database/database.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [InventoryController],
  providers: [InventoryService],
})
export class InventoryModule {}
