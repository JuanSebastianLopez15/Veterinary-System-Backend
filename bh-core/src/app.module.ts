import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

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
import { FacturacionModule } from './facturacion/facturacion.module';
import { HospitalizationModule } from './hospitalization/hospitalization.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USER', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', 'postgres'),
        database: configService.get<string>('DB_NAME', 'veterinaria'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false,
      }),
      inject: [ConfigService],
    }),
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
    FacturacionModule,
    HospitalizationModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
