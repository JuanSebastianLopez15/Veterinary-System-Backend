import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';

import { AuditService } from '../audit/audit.service';
import { DATABASE_POOL } from '../database/database.provider';

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
    @Inject(DATABASE_POOL) private readonly pool: Pool,
    private readonly auditService: AuditService,
  ) {}

  async create(appointmentId: string, data: CreateMedicalRecordData) {
    const apptResult = await this.pool.query<Record<string, unknown>>(
      'SELECT mascota_codigo FROM Cita WHERE codigo = $1',
      [appointmentId],
    );
    if (apptResult.rowCount === 0) {
      throw new NotFoundException('Cita no encontrada');
    }
    const petId = apptResult.rows[0].mascota_codigo as string;

    const editableUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const recordResult = await this.pool.query<Record<string, unknown>>(
      `INSERT INTO Historial_Medico
         (cita_codigo, mascota_codigo, veterinario_codigo, motivo_visita, diagnostico,
          tratamiento_aplicado, peso_mascota, proxima_visita, editable_hasta)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        appointmentId,
        petId,
        data.veterinarianId,
        data.visitReason,
        data.diagnosis,
        data.treatment,
        data.petWeight,
        data.nextVisitDate ?? null,
        editableUntil,
      ],
    );
    const record = recordResult.rows[0];
    const recordId = record.codigo as string;

    const stockAlerts: Array<{ productName: string; currentStock: number; minStock: number }> = [];
    const savedPrescriptions: PrescriptionInput[] = [];

    for (const prescription of data.prescriptions ?? []) {
      const quantity = prescription.quantity ?? 1;

      await this.pool.query(
        `INSERT INTO Medicamento_Prescrito
           (historial_codigo, producto_codigo, dosis, duracion, cantidad_medicamentos_prescritos)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          recordId,
          prescription.inventoryProductId ?? null,
          prescription.dosage,
          prescription.duration,
          quantity,
        ],
      );

      // Descuento automático solo si el medicamento está vinculado al inventario
      if (prescription.inventoryProductId) {
        const productResult = await this.pool.query<Record<string, unknown>>(
          'SELECT * FROM Producto WHERE codigo = $1',
          [prescription.inventoryProductId],
        );

        if (productResult.rowCount > 0) {
          const product = productResult.rows[0];
          const updatedResult = await this.pool.query<Record<string, unknown>>(
            'UPDATE Producto SET stock = stock - $1 WHERE codigo = $2 RETURNING stock, stock_minimo, nombre',
            [quantity, prescription.inventoryProductId],
          );
          const updated = updatedResult.rows[0];
          const newStock = updated.stock as number;
          const minStock = updated.stock_minimo as number;

          if (newStock < minStock) {
            stockAlerts.push({
              productName: updated.nombre as string,
              currentStock: newStock,
              minStock,
            });
          }

          void product; // referenciado para claridad en logs futuros
        }
        // Si el producto no existe en inventario, se guarda la prescripción normalmente sin descuento
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
      nextVisitDate: record.proxima_visita ?? null,
      editableUntil: record.editable_hasta,
      createdAt: record.creado_en,
      updatedAt: null,
      prescriptions: savedPrescriptions,
      ...(stockAlerts.length > 0 && { stockAlerts }),
    };
  }
}
