import { Module } from '@nestjs/common';

import { databaseProvider } from './database.provider';
import { PrismaService } from './prisma.service';

@Module({
  providers: [databaseProvider, PrismaService],
  exports: [databaseProvider, PrismaService],
})
export class DatabaseModule {}
