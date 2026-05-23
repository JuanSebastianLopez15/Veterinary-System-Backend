import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';
import {AuditService} from "../audit/audit.service";

@Module({
  imports: [DatabaseModule],
  controllers: [ClientesController],
  providers: [ClientesService,AuditService],

})
export class ClientesModule {}