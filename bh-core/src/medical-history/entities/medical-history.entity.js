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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MedicalHistory = void 0;
const typeorm_1 = require("typeorm");
const prescribed_medication_entity_1 = require("./prescribed-medication.entity");
const vaccine_entity_1 = require("./vaccine.entity");
let MedicalHistory = class MedicalHistory {
};
exports.MedicalHistory = MedicalHistory;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], MedicalHistory.prototype, "codigo", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'cita_codigo' }),
    __metadata("design:type", String)
], MedicalHistory.prototype, "citaCodigo", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'mascota_codigo' }),
    __metadata("design:type", String)
], MedicalHistory.prototype, "mascotaCodigo", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'veterinario_codigo' }),
    __metadata("design:type", String)
], MedicalHistory.prototype, "veterinarioCodigo", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'motivo_visita' }),
    __metadata("design:type", String)
], MedicalHistory.prototype, "motivoVisita", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], MedicalHistory.prototype, "diagnostico", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'tratamiento_aplicado' }),
    __metadata("design:type", String)
], MedicalHistory.prototype, "tratamientoAplicado", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'peso_mascota', type: 'float' }),
    __metadata("design:type", Number)
], MedicalHistory.prototype, "pesoMascota", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'proxima_visita', type: 'date', nullable: true }),
    __metadata("design:type", Date)
], MedicalHistory.prototype, "proximaVisita", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'editable_hasta', type: 'timestamp' }),
    __metadata("design:type", Date)
], MedicalHistory.prototype, "editableHasta", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'creado_en', type: 'timestamp', default: () => 'now()' }),
    __metadata("design:type", Date)
], MedicalHistory.prototype, "creadoEn", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => prescribed_medication_entity_1.PrescribedMedication, (med) => med.historial, { cascade: true }),
    __metadata("design:type", Array)
], MedicalHistory.prototype, "medicamentos", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => vaccine_entity_1.Vaccine, (vac) => vac.historial, { cascade: true }),
    __metadata("design:type", Array)
], MedicalHistory.prototype, "vacunas", void 0);
exports.MedicalHistory = MedicalHistory = __decorate([
    (0, typeorm_1.Entity)('Historial_Medico')
], MedicalHistory);
//# sourceMappingURL=medical-history.entity.js.map