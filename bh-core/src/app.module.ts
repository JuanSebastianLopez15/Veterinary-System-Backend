import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppointmentsModule } from './appointments/appointments.module';
import { DatabaseModule } from './database/database.module';
import { InventoryModule } from './inventory/inventory.module';
import { MedicalRecordsModule } from './medical-records/medical-records.module';
import { ServicesModule } from './services/services.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AppointmentsModule,
    InventoryModule,
    ServicesModule,
    MedicalRecordsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
