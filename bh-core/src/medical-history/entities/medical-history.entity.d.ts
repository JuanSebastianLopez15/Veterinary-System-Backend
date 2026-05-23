import { PrescribedMedication } from './prescribed-medication.entity';
import { Vaccine } from './vaccine.entity';
export declare class MedicalHistory {
    codigo: string;
    citaCodigo: string;
    mascotaCodigo: string;
    veterinarioCodigo: string;
    motivoVisita: string;
    diagnostico: string;
    tratamientoAplicado: string;
    pesoMascota: number;
    proximaVisita: Date;
    editableHasta: Date;
    creadoEn: Date;
    medicamentos: PrescribedMedication[];
    vacunas: Vaccine[];
}
