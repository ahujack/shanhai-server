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
var ReadingController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadingController = void 0;
const common_1 = require("@nestjs/common");
const common_2 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const reading_service_1 = require("./reading.service");
const create_reading_dto_1 = require("./dto/create-reading.dto");
let ReadingController = ReadingController_1 = class ReadingController {
    readingService;
    prisma = new client_1.PrismaClient();
    constructor(readingService) {
        this.readingService = readingService;
    }
    async create(dto) {
        const result = await this.readingService.generate(dto);
        if (dto.userId) {
            try {
                await this.prisma.reading.create({
                    data: {
                        userId: dto.userId,
                        question: dto.question,
                        category: dto.category,
                        result: JSON.stringify(result),
                    },
                });
            }
            catch (error) {
                common_2.Logger.error('保存占卜记录失败', error.message, ReadingController_1.name);
            }
        }
        return result;
    }
};
exports.ReadingController = ReadingController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_reading_dto_1.CreateReadingDto]),
    __metadata("design:returntype", Promise)
], ReadingController.prototype, "create", null);
exports.ReadingController = ReadingController = ReadingController_1 = __decorate([
    (0, common_1.Controller)('readings'),
    __metadata("design:paramtypes", [reading_service_1.ReadingService])
], ReadingController);
//# sourceMappingURL=reading.controller.js.map