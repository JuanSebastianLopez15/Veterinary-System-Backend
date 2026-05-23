import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppointmentsModule } from './appointments/appointments.module';
import { AuthModule } from './auth/auth.module';
import { ClientesModule } from './clientes/clientes.module';
import { DatabaseModule } from './database/database.module';
import { InventoryModule } from './inventory/inventory.module';
import { MedicalRecordsModule } from './medical-records/medical-records.module';
import { MedicalHistoryModule } from './medical-history/medical-history.module';
import { ServicesModule } from './services/services.module';
import { UsersModule } from './users/users.module';
import { MascotasModule } from './mascotas/mascotas.module';
import { ReportesPdfModule } from './reportesPDF/reportes-pdf.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    AppointmentsModule,
    ClientesModule,
    InventoryModule,
    ServicesModule,
    MedicalRecordsModule,
    MedicalHistoryModule,
    UsersModule,
    MascotasModule,
    ReportesPdfModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
