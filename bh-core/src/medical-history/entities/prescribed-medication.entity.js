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
exports.PrescribedMedication = void 0;
const typeorm_1 = require("typeorm");
const medical_history_entity_1 = require("./medical-history.entity");
let PrescribedMedication = class PrescribedMedication {
};
exports.PrescribedMedication = PrescribedMedication;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], PrescribedMedication.prototype, "codigo", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'historial_codigo' }),
    __metadata("design:type", String)
], PrescribedMedication.prototype, "historialCodigo", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'producto_codigo', nullable: true }),
    __metadata("design:type", String)
], PrescribedMedication.prototype, "productoCodigo", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PrescribedMedication.prototype, "dosis", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PrescribedMedication.prototype, "duracion", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'cantidad_medicamentos_prescritos' }),
    __metadata("design:type", Number)
], PrescribedMedication.prototype, "cantidad", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => medical_history_entity_1.MedicalHistory, (h) => h.medicamentos),
    (0, typeorm_1.JoinColumn)({ name: 'historial_codigo' }),
    __metadata("design:type", medical_history_entity_1.MedicalHistory)
], PrescribedMedication.prototype, "historial", void 0);
exports.PrescribedMedication = PrescribedMedication = __decorate([
    (0, typeorm_1.Entity)('Medicamento_Prescrito')
], PrescribedMedication);
//# sourceMappingURL=prescribed-medication.entity.js.map