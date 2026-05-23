declare class MedicamentoDto {
    productoCodigo?: string;
    dosis: string;
    duracion: string;
    cantidad: number;
}
declare class VacunaDto {
    nombre: string;
    fecha: string;
    fechaSiguienteVacuna?: string;
}
export declare class CreateMedicalHistoryDto {
    motivo_visita: string;
    diagnostico: string;
    tratamiento_aplicado: string;
    peso_mascota: number;
    proxima_visita?: string;
    medicamentos?: MedicamentoDto[];
    vacunas?: VacunaDto[];
}
export {};
