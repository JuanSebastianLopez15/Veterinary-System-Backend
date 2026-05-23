import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { HealthController } from './health.controller';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
