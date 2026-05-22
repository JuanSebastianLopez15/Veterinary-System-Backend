import { MedicalHistory } from './medical-history.entity';
export declare class Vaccine {
    codigo: string;
    historialCodigo: string;
    mascotaCodigo: string;
    nombre: string;
    fecha: Date;
    fechaSiguienteVacuna: Date;
    historial: MedicalHistory;
}
