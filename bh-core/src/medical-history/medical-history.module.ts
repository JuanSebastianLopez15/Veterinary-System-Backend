import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedicalHistoryController, VaccineController } from './medical-history.controller';
import { MedicalHistoryService } from './medical-history.service';
import { MedicalHistory } from './entities/medical-history.entity';
import { PrescribedMedication } from './entities/prescribed-medication.entity';
import { Vaccine } from './entities/vaccine.entity';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MedicalHistory, PrescribedMedication, Vaccine]),
    AuditModule,
  ],
  controllers: [MedicalHistoryController, VaccineController],
  providers: [MedicalHistoryService],
  exports: [MedicalHistoryService],
})
export class MedicalHistoryModule {}
