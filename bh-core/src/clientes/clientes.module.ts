import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';

@Module({
  imports: [DatabaseModule],
  controllers: [ClientesController],
  providers: [ClientesService],
})
export class ClientesModule {}