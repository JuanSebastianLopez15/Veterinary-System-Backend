import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppointmentsModule } from './appointments/appointments.module';
import { DatabaseModule } from './database/database.module';
import { ClientesModule } from './clientes/clientes.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AppointmentsModule,
    ClientesModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
