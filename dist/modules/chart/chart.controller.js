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
exports.ChartController = void 0;
const common_1 = require("@nestjs/common");
const chart_service_1 = require("./chart.service");
const user_service_1 = require("../user/user.service");
let ChartController = class ChartController {
    chartService;
    userService;
    constructor(chartService, userService) {
        this.chartService = chartService;
        this.userService = userService;
    }
    async generate(userId, body) {
        const user = this.userService.findOne(userId);
        return await this.chartService.generateChart(userId, user.birthDate, user.birthTime, body.gender);
    }
    findOne(userId) {
        const chart = this.chartService.findOne(userId);
        if (!chart) {
            return { message: '请先创建命盘', hasChart: false };
        }
        return { hasChart: true, chart };
    }
};
exports.ChartController = ChartController;
__decorate([
    (0, common_1.Post)(':userId'),
    __param(0, (0, common_1.Param)('userId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ChartController.prototype, "generate", null);
__decorate([
    (0, common_1.Get)(':userId'),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ChartController.prototype, "findOne", null);
exports.ChartController = ChartController = __decorate([
    (0, common_1.Controller)('charts'),
    __metadata("design:paramtypes", [chart_service_1.ChartService,
        user_service_1.UserService])
], ChartController);
//# sourceMappingURL=chart.controller.js.map