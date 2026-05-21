import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../audit/audit.service';

interface PrescriptionInput {
  medicationName: string;
  dosage: string;
  duration: string;
  inventoryProductId?: string | null;
  quantity?: number;
}

interface CreateMedicalRecordData {
  visitReason: string;
  diagnosis: string;
  treatment: string;
  petWeight: number;
  nextVisitDate?: string;
  prescriptions?: PrescriptionInput[];
  veterinarianId: string;
}

@Injectable()
export class MedicalRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(appointmentId: string, data: CreateMedicalRecordData) {
    const cita = await this.prisma.cita.findUnique({
      where: { codigo: appointmentId },
      select: { mascota_codigo: true },
    });

    if (!cita) {
      throw new NotFoundException('Cita no encontrada');
    }
    const petId = cita.mascota_codigo;

    const editableUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);

    return await this.prisma.$transaction(async (tx) => {
      const record = await tx.historial_medico.create({
        data: {
          cita_codigo: appointmentId,
          mascota_codigo: petId,
          veterinario_codigo: data.veterinarianId,
          motivo_visita: data.visitReason,
          diagnostico: data.diagnosis,
          tratamiento_aplicado: data.treatment,
          peso_mascota: data.petWeight,
          proxima_visita: data.nextVisitDate ? new Date(data.nextVisitDate) : null,
          editable_hasta: editableUntil,
        },
      });

      const recordId = record.codigo;
      const stockAlerts: Array<{ productName: string; currentStock: number; minStock: number }> = [];
      const savedPrescriptions: PrescriptionInput[] = [];

      for (const prescription of data.prescriptions ?? []) {
        const quantity = prescription.quantity ?? 1;

        await tx.medicamento_prescrito.create({
          data: {
            historial_codigo: recordId,
            producto_codigo: prescription.inventoryProductId ?? null,
            dosis: prescription.dosage,
            duracion: prescription.duration,
            cantidad_medicamentos_prescritos: quantity,
          },
        });

        if (prescription.inventoryProductId) {
          const product = await tx.producto.findUnique({
            where: { codigo: prescription.inventoryProductId },
          });

          if (product) {
            const updated = await tx.producto.update({
              where: { codigo: prescription.inventoryProductId },
              data: { stock: { decrement: quantity } },
            });

            if (updated.stock < updated.stock_minimo) {
              stockAlerts.push({
                productName: updated.nombre,
                currentStock: updated.stock,
                minStock: updated.stock_minimo,
              });
            }
          }
        }

        savedPrescriptions.push({
          medicationName: prescription.medicationName,
          dosage: prescription.dosage,
          duration: prescription.duration,
          inventoryProductId: prescription.inventoryProductId ?? null,
          quantity,
        });
      }

      this.auditService.emit({
        action: 'CREACION_HISTORIAL_MEDICO',
        userId: data.veterinarianId,
        userRole: 'veterinario',
        entityType: 'MedicalRecord',
        entityId: recordId,
        details: {
          appointmentId,
          petId,
          prescriptionsCount: savedPrescriptions.length,
          stockAdjusted: savedPrescriptions.filter((p) => p.inventoryProductId).length,
          stockAlerts: stockAlerts.map((a) => a.productName),
        },
      });

      return {
        id: recordId,
        appointmentId: record.cita_codigo,
        petId: record.mascota_codigo,
        veterinarianId: record.veterinario_codigo,
        visitReason: record.motivo_visita,
        diagnosis: record.diagnostico,
        treatment: record.tratamiento_aplicado,
        petWeight: record.peso_mascota,
        nextVisitDate: record.proxima_visita
          ? record.proxima_visita.toISOString().split('T')[0]
          : null,
        editableUntil: record.editable_hasta,
        createdAt: record.creado_en,
        updatedAt: null,
        prescriptions: savedPrescriptions,
        ...(stockAlerts.length > 0 && { stockAlerts }),
      };
    });
  }
}
