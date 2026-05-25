import { Module } from '@nestjs/common';
import { FacturacionService } from './facturacion.service';
import { FacturacionController } from './facturacion.controller';
import {DatabaseModule} from "../database/database.module";
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    DatabaseModule,
    AuditModule,
  ],
  controllers: [FacturacionController],
  providers: [FacturacionService],
})
export class FacturacionModule {}