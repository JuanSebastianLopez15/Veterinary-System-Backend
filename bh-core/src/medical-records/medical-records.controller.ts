import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
} from '@nestjs/common';

import { MedicalRecordsService } from './medical-records.service';

@Controller('appointments')
export class MedicalRecordsController {
  constructor(private readonly medicalRecordsService: MedicalRecordsService) {}

  @Post(':appointmentId/medical-records')
  async create(
    @Param('appointmentId') appointmentId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const { visitReason, diagnosis, treatment, petWeight, nextVisitDate, prescriptions, veterinarianId } = body;

    if (!visitReason || !diagnosis || !treatment || petWeight === undefined || !veterinarianId) {
      throw new BadRequestException(
        'visitReason, diagnosis, treatment, petWeight y veterinarianId son obligatorios',
      );
    }
    if (typeof petWeight !== 'number' || petWeight <= 0) {
      throw new BadRequestException('petWeight debe ser un número positivo');
    }
    if (prescriptions !== undefined && !Array.isArray(prescriptions)) {
      throw new BadRequestException('prescriptions debe ser un arreglo');
    }

    const parsedPrescriptions = ((prescriptions as unknown[]) ?? []).map((p: unknown) => {
      const prescription = p as Record<string, unknown>;
      if (!prescription.medicationName || !prescription.dosage || !prescription.duration) {
        throw new BadRequestException(
          'Cada prescripción requiere medicationName, dosage y duration',
        );
      }
      return {
        medicationName: prescription.medicationName as string,
        dosage: prescription.dosage as string,
        duration: prescription.duration as string,
        inventoryProductId: (prescription.inventoryProductId as string | null) ?? null,
        quantity:
          prescription.quantity !== undefined ? Number(prescription.quantity) : 1,
      };
    });

    return this.medicalRecordsService.create(appointmentId, {
      visitReason: visitReason as string,
      diagnosis: diagnosis as string,
      treatment: treatment as string,
      petWeight: petWeight as number,
      nextVisitDate: nextVisitDate as string | undefined,
      prescriptions: parsedPrescriptions,
      veterinarianId: veterinarianId as string,
    });
  }
}
