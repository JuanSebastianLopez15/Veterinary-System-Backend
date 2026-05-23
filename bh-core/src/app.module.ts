import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppointmentsModule } from './appointments/appointments.module';
import { AuthModule } from './auth/auth.module';
import { ClientesModule } from './clientes/clientes.module';
import { DatabaseModule } from './database/database.module';
import { InventoryModule } from './inventory/inventory.module';
import { MedicalHistoryModule } from './medical-history/medical-history.module';
import { ServicesModule } from './services/services.module';
import { UsersModule } from './users/users.module';
import { MascotasModule } from './mascotas/mascotas.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT, 10),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: false,
    }),
    DatabaseModule,
    AuthModule,
    AppointmentsModule,
    ClientesModule,
    InventoryModule,
    ServicesModule,
    MedicalHistoryModule,
    UsersModule,
    MascotasModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
