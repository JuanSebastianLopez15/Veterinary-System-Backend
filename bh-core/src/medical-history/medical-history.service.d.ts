import { Repository, DataSource } from 'typeorm';
import { MedicalHistory } from './entities/medical-history.entity';
import { PrescribedMedication } from './entities/prescribed-medication.entity';
import { Vaccine } from './entities/vaccine.entity';
import { CreateMedicalHistoryDto } from './dto/create-medical-history.dto';
import { EditMedicalHistoryDto } from './dto/edit-medical-history.dto';
import { AuditService } from '../audit/audit.service';
export declare class MedicalHistoryService {
    private historialRepo;
    private medicamentoRepo;
    private vacunaRepo;
    private dataSource;
    private auditService;
    constructor(historialRepo: Repository<MedicalHistory>, medicamentoRepo: Repository<PrescribedMedication>, vacunaRepo: Repository<Vaccine>, dataSource: DataSource, auditService: AuditService);
    create(citaCodigo: string, dto: CreateMedicalHistoryDto, veterinarianCode: string): Promise<{
        mensaje: string;
        codigo: string;
    }>;
    edit(citaCodigo: string, dto: EditMedicalHistoryDto, veterinarianCode: string): Promise<{
        mensaje: string;
    }>;
    getUpcomingVaccines(): Promise<any>;
}
