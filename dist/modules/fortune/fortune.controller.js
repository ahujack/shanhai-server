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
exports.FortuneController = void 0;
const common_1 = require("@nestjs/common");
const fortune_service_1 = require("./fortune.service");
let FortuneController = class FortuneController {
    fortuneService;
    constructor(fortuneService) {
        this.fortuneService = fortuneService;
    }
    getDailyFortune(userId) {
        return this.fortuneService.getDailyFortune(userId);
    }
    drawRandom() {
        return this.fortuneService.drawRandomSlip();
    }
    getByIndex(index) {
        return this.fortuneService.getSlipByIndex(index);
    }
};
exports.FortuneController = FortuneController;
__decorate([
    (0, common_1.Get)('daily'),
    __param(0, (0, common_1.Query)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FortuneController.prototype, "getDailyFortune", null);
__decorate([
    (0, common_1.Get)('draw'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], FortuneController.prototype, "drawRandom", null);
__decorate([
    (0, common_1.Get)(':index'),
    __param(0, (0, common_1.Query)('index')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], FortuneController.prototype, "getByIndex", null);
exports.FortuneController = FortuneController = __decorate([
    (0, common_1.Controller)('fortunes'),
    __metadata("design:paramtypes", [fortune_service_1.FortuneService])
], FortuneController);
//# sourceMappingURL=fortune.controller.js.map