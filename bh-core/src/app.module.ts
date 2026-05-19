import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppointmentsModule } from './appointments/appointments.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AppointmentsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
