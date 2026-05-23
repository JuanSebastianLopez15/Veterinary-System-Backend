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
exports.MedicalHistoryController = void 0;
const common_1 = require("@nestjs/common");
const medical_history_service_1 = require("./medical-history.service");
const create_medical_history_dto_1 = require("./dto/create-medical-history.dto");
const edit_medical_history_dto_1 = require("./dto/edit-medical-history.dto");
let MedicalHistoryController = class MedicalHistoryController {
    constructor(service) {
        this.service = service;
    }
    create(citaId, veterinarianCode, dto) {
        return this.service.create(citaId, dto, veterinarianCode);
    }
    edit(citaId, veterinarianCode, dto) {
        return this.service.edit(citaId, dto, veterinarianCode);
    }
    getUpcomingVaccines(veterinarianCode, recepcionistaCode) {
        const userCode = veterinarianCode || recepcionistaCode;
        if (!userCode) {
            throw new Error('Unauthorized');
        }
        return this.service.getUpcomingVaccines();
    }
};
exports.MedicalHistoryController = MedicalHistoryController;
__decorate([
    (0, common_1.Post)(':citaId/medical-history'),
    __param(0, (0, common_1.Param)('citaId')),
    __param(1, (0, common_1.Headers)('x-veterinario-codigo')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, create_medical_history_dto_1.CreateMedicalHistoryDto]),
    __metadata("design:returntype", void 0)
], MedicalHistoryController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':citaId/medical-history'),
    __param(0, (0, common_1.Param)('citaId')),
    __param(1, (0, common_1.Headers)('x-veterinario-codigo')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, edit_medical_history_dto_1.EditMedicalHistoryDto]),
    __metadata("design:returntype", void 0)
], MedicalHistoryController.prototype, "edit", null);
__decorate([
    (0, common_1.Get)('vaccines/upcoming'),
    __param(0, (0, common_1.Headers)('x-veterinario-codigo')),
    __param(1, (0, common_1.Headers)('x-recepcionista-codigo')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], MedicalHistoryController.prototype, "getUpcomingVaccines", null);
exports.MedicalHistoryController = MedicalHistoryController = __decorate([
    (0, common_1.Controller)('appointments'),
    __metadata("design:paramtypes", [medical_history_service_1.MedicalHistoryService])
], MedicalHistoryController);
//# sourceMappingURL=medical-history.controller.js.map