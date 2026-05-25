import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';
import {AuditService} from "../audit/audit.service";

/** Módulo de clientes — agrupa el controlador y el servicio de clientes */
@Module({
  imports: [DatabaseModule],
  controllers: [ClientesController],
  providers: [ClientesService,AuditService],

})
export class ClientesModule {}