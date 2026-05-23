import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MedicalHistoryService } from './medical-history.service';
import { MedicalHistory } from './entities/medical-history.entity';
import { PrescribedMedication } from './entities/prescribed-medication.entity';
import { Vaccine } from './entities/vaccine.entity';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

jest.mock('uuid', () => ({
  v4: () => 'mock-uuid',
}));

describe('MedicalHistoryService', () => {
  let service: MedicalHistoryService;
  let historialRepo: any;
  let medicamentoRepo: any;
  let vacunaRepo: any;
  let dataSource: any;
  let auditService: any;

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      save: jest.fn(),
      query: jest.fn(),
    },
  };

  beforeEach(async () => {
    historialRepo = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn(),
    };
    medicamentoRepo = {
      save: jest.fn(),
    };
    vacunaRepo = {
      save: jest.fn(),
    };
    dataSource = {
      query: jest.fn(),
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };
    auditService = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MedicalHistoryService,
        {
          provide: getRepositoryToken(MedicalHistory),
          useValue: historialRepo,
        },
        {
          provide: getRepositoryToken(PrescribedMedication),
          useValue: medicamentoRepo,
        },
        {
          provide: getRepositoryToken(Vaccine),
          useValue: vacunaRepo,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: AuditService,
          useValue: auditService,
        },
      ],
    }).compile();

    service = module.get<MedicalHistoryService>(MedicalHistoryService);
  });

  it('should create medical history successfully', async () => {
    const citaId = 'cita-01';
    const vetCode = 'vet-01';
    const dto = {
      motivo_visita: 'Consulta de rutina',
      diagnostico: 'Sano',
      tratamiento_aplicado: 'Ninguno',
      peso_mascota: 10.5,
      proxima_visita: '2024-07-10',
      medicamentos: [
        {
          productoCodigo: 'prod-01',
          dosis: '1 tableta',
          duracion: '3 días',
          cantidad: 1,
        },
      ],
      vacunas: [
        {
          nombre: 'Rabia',
          fecha: '2024-06-10',
          fechaSiguienteVacuna: '2025-06-10',
        },
      ],
    };

    dataSource.query.mockResolvedValueOnce([{
      codigo: citaId,
      usuario_codigo: vetCode,
      mascota_codigo: 'pet-01',
      estado: 'confirmada',
    }]);

    historialRepo.findOne.mockResolvedValue(null);
    mockQueryRunner.manager.query.mockResolvedValueOnce([{ stock: 10 }]); // For stock check

    const result = await service.create(citaId, dto, vetCode);

    expect(result).toBeDefined();
    expect(result.mensaje).toBe('Historial médico registrado exitosamente');
    expect(mockQueryRunner.manager.save).toHaveBeenCalled();
    expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalled();
  });

  it('should throw NotFoundException if appointment does not exist', async () => {
    dataSource.query.mockResolvedValueOnce([]);
    await expect(service.create('invalid', {} as any, 'vet-01')).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException if vet is not assigned to the appointment', async () => {
    dataSource.query.mockResolvedValueOnce([{
      codigo: 'cita-01',
      usuario_codigo: 'other-vet',
      mascota_codigo: 'pet-01',
      estado: 'confirmada',
    }]);
    await expect(service.create('cita-01', {} as any, 'vet-01')).rejects.toThrow(ForbiddenException);
  });

  it('should throw BadRequestException if appointment is cancelled', async () => {
    dataSource.query.mockResolvedValueOnce([{
      codigo: 'cita-01',
      usuario_codigo: 'vet-01',
      mascota_codigo: 'pet-01',
      estado: 'cancelada',
    }]);
    await expect(service.create('cita-01', {} as any, 'vet-01')).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException if history already exists', async () => {
    dataSource.query.mockResolvedValueOnce([{
      codigo: 'cita-01',
      usuario_codigo: 'vet-01',
      mascota_codigo: 'pet-01',
      estado: 'confirmada',
    }]);
    historialRepo.findOne.mockResolvedValue({ codigo: 'existing' });
    await expect(service.create('cita-01', {} as any, 'vet-01')).rejects.toThrow(BadRequestException);
  });
});
