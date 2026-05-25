import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedicalHistoryController, VaccineController, PetHistoryController } from './medical-history.controller';
import { MedicalHistoryService } from './medical-history.service';
import { MedicalHistory } from './entities/medical-history.entity';
import { PrescribedMedication } from './entities/prescribed-medication.entity';
import { Vaccine } from './entities/vaccine.entity';
import { Pet } from './entities/pet.entity';
import { Appointment } from './entities/appointment.entity';
import { Hospitalization } from './entities/hospitalization.entity';
import { EvolutionNote } from './entities/evolution-note.entity';
import { AuditModule } from '../audit/audit.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MedicalHistory,
      PrescribedMedication,
      Vaccine,
      Pet,
      Appointment,
      Hospitalization,
      EvolutionNote,
    ]),
    AuditModule,
    InventoryModule,
  ],
  controllers: [MedicalHistoryController, VaccineController, PetHistoryController],
  providers: [MedicalHistoryService],
  exports: [MedicalHistoryService],
})
export class MedicalHistoryModule {}
