import { MedicalHistoryService } from './medical-history.service';
import { CreateMedicalHistoryDto } from './dto/create-medical-history.dto';
import { EditMedicalHistoryDto } from './dto/edit-medical-history.dto';
export declare class MedicalHistoryController {
    private readonly service;
    constructor(service: MedicalHistoryService);
    create(citaId: string, veterinarianCode: string, dto: CreateMedicalHistoryDto): Promise<{
        mensaje: string;
        codigo: string;
    }>;
    edit(citaId: string, veterinarianCode: string, dto: EditMedicalHistoryDto): Promise<{
        mensaje: string;
    }>;
    getUpcomingVaccines(veterinarianCode: string, recepcionistaCode: string): Promise<any>;
}
