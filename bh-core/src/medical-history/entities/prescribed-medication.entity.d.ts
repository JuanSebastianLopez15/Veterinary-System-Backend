import { MedicalHistory } from './medical-history.entity';
export declare class PrescribedMedication {
    codigo: string;
    historialCodigo: string;
    productoCodigo: string;
    dosis: string;
    duracion: string;
    cantidad: number;
    historial: MedicalHistory;
}
