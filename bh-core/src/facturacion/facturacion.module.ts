import { Module } from '@nestjs/common';
import { FacturacionService } from './facturacion.service';
import { FacturacionController } from './facturacion.controller';
import {DatabaseModule} from "../database/database.module";

@Module({
  imports: [
    DatabaseModule,
  ],
  controllers: [FacturacionController],
  providers: [FacturacionService],
})
export class FacturacionModule {}