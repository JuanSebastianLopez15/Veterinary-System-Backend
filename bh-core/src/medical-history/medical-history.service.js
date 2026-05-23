"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MedicalHistoryService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const uuid_1 = require("uuid");
const medical_history_entity_1 = require("./entities/medical-history.entity");
const prescribed_medication_entity_1 = require("./entities/prescribed-medication.entity");
const vaccine_entity_1 = require("./entities/vaccine.entity");
const audit_service_1 = require("../audit/audit.service");
let MedicalHistoryService = class MedicalHistoryService {
    constructor(historialRepo, medicamentoRepo, vacunaRepo, dataSource, auditService) {
        this.historialRepo = historialRepo;
        this.medicamentoRepo = medicamentoRepo;
        this.vacunaRepo = vacunaRepo;
        this.dataSource = dataSource;
        this.auditService = auditService;
    }
    async create(citaCodigo, dto, veterinarianCode) {
        const cita = await this.dataSource.query(`SELECT * FROM "Cita" WHERE codigo = $1`, [citaCodigo]);
        if (!cita.length)
            throw new common_1.NotFoundException('Cita no encontrada');
        if (cita[0].usuario_codigo !== veterinarianCode)
            throw new common_1.ForbiddenException('No tienes permiso sobre esta cita');
        if (cita[0].estado === 'cancelada')
            throw new common_1.BadRequestException('No se puede registrar historial de una cita cancelada');
        const existe = await this.historialRepo.findOne({ where: { citaCodigo } });
        if (existe)
            throw new common_1.BadRequestException('Esta cita ya tiene historial registrado');
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const historialCodigo = `HM-${(0, uuid_1.v4)()}`;
            const editableUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
            const historial = this.historialRepo.create({
                codigo: historialCodigo,
                citaCodigo,
                mascotaCodigo: cita[0].mascota_codigo,
                veterinarioCodigo: veterinarianCode,
                motivoVisita: dto.motivo_visita,
                diagnostico: dto.diagnostico,
                tratamientoAplicado: dto.tratamiento_aplicado,
                pesoMascota: dto.peso_mascota,
                proximaVisita: dto.proxima_visita ? new Date(dto.proxima_visita) : null,
                editableHasta: editableUntil,
            });
            await queryRunner.manager.save(medical_history_entity_1.MedicalHistory, historial);
            if (dto.medicamentos?.length) {
                for (const med of dto.medicamentos) {
                    await queryRunner.manager.save(prescribed_medication_entity_1.PrescribedMedication, {
                        codigo: `MP-${(0, uuid_1.v4)()}`,
                        historialCodigo,
                        productoCodigo: med.productoCodigo ?? null,
                        dosis: med.dosis,
                        duracion: med.duracion,
                        cantidad_medicamentos_prescritos: med.cantidad,
                    });
                    if (med.productoCodigo) {
                        const producto = await queryRunner.manager.query(`SELECT stock FROM "Producto" WHERE codigo = $1`, [med.productoCodigo]);
                        if (producto.length && producto[0].stock >= med.cantidad) {
                            await queryRunner.manager.query(`UPDATE "Producto" SET stock = stock - $1 WHERE codigo = $2`, [med.cantidad, med.productoCodigo]);
                        }
                    }
                }
            }
            if (dto.vacunas?.length) {
                for (const vac of dto.vacunas) {
                    await queryRunner.manager.save(vaccine_entity_1.Vaccine, {
                        codigo: `VAC-${(0, uuid_1.v4)()}`,
                        historialCodigo,
                        mascotaCodigo: cita[0].mascota_codigo,
                        nombre: vac.nombre,
                        fecha: new Date(vac.fecha),
                        fecha_siguiente_vacuna: vac.fechaSiguienteVacuna
                            ? new Date(vac.fechaSiguienteVacuna)
                            : null,
                    });
                }
            }
            await queryRunner.manager.query(`UPDATE "Mascotas" SET peso = $1 WHERE codigo = $2`, [dto.peso_mascota, cita[0].mascota_codigo]);
            await queryRunner.commitTransaction();
            this.auditService.notifyEvent({
                eventType: 'CREACION_HISTORIAL_MEDICO',
                payload: {
                    historial: {
                        codigo: historialCodigo,
                        citaCodigo,
                        mascotaCodigo: cita[0].mascota_codigo,
                        veterinarianCode,
                    },
                },
            }).catch(() => { });
            return { mensaje: 'Historial médico registrado exitosamente', codigo: historialCodigo };
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        }
        finally {
            await queryRunner.release();
        }
    }
    async edit(citaCodigo, dto, veterinarianCode) {
        const historial = await this.historialRepo.findOne({ where: { citaCodigo } });
        if (!historial)
            throw new common_1.NotFoundException('Historial médico no encontrado');
        if (historial.veterinarioCodigo !== veterinarianCode)
            throw new common_1.ForbiddenException('No tienes permiso sobre este historial');
        if (new Date() > historial.editableHasta)
            throw new common_1.BadRequestException('El historial ya no es editable');
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            if (dto.motivo_visita !== undefined) {
                historial.motivoVisita = dto.motivo_visita;
            }
            if (dto.diagnostico !== undefined) {
                historial.diagnostico = dto.diagnostico;
            }
            if (dto.tratamiento_aplicado !== undefined) {
                historial.tratamientoAplicado = dto.tratamiento_aplicado;
            }
            if (dto.proxima_visita !== undefined) {
                historial.proximaVisita = dto.proxima_visita ? new Date(dto.proxima_visita) : null;
            }
            await queryRunner.manager.save(medical_history_entity_1.MedicalHistory, historial);
            await queryRunner.commitTransaction();
            this.auditService.notifyEvent({
                eventType: 'EDICION_HISTORIAL_MEDICO',
                payload: {
                    historial: {
                        codigo: historial.codigo,
                        citaCodigo,
                    },
                },
            }).catch(() => { });
            return { mensaje: 'Historial médico editado exitosamente' };
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        }
        finally {
            await queryRunner.release();
        }
    }
    async getUpcomingVaccines() {
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        const vaccines = await this.dataSource.query(`SELECT v.codigo, v.nombre, v."fecha_siguiente_vacuna", v."mascota_codigo", v."historial_codigo" 
       FROM "Vacuna" v 
       WHERE v."fecha_siguiente_vacuna" >= CURRENT_DATE 
         AND v."fecha_siguiente_vacuna" <= $1
         AND v."fecha_siguiente_vacuna" IS NOT NULL`, [thirtyDaysFromNow]);
        return vaccines;
    }
};
exports.MedicalHistoryService = MedicalHistoryService;
exports.MedicalHistoryService = MedicalHistoryService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(medical_history_entity_1.MedicalHistory)),
    __param(1, (0, typeorm_1.InjectRepository)(prescribed_medication_entity_1.PrescribedMedication)),
    __param(2, (0, typeorm_1.InjectRepository)(vaccine_entity_1.Vaccine)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource,
        audit_service_1.AuditService])
], MedicalHistoryService);
//# sourceMappingURL=medical-history.service.js.map