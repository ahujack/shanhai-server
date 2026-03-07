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
var ZiController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZiController = exports.AnalyzeHandwritingDto = exports.RecognizeDto = exports.AnalyzeZiDto = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const common_2 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const zi_service_1 = require("./zi.service");
const ocr_service_1 = require("../ocr/ocr.service");
class AnalyzeZiDto {
    zi;
    handwriting;
    userId;
}
exports.AnalyzeZiDto = AnalyzeZiDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AnalyzeZiDto.prototype, "zi", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AnalyzeZiDto.prototype, "userId", void 0);
class RecognizeDto {
    image;
}
exports.RecognizeDto = RecognizeDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RecognizeDto.prototype, "image", void 0);
class AnalyzeHandwritingDto {
    image;
    userId;
}
exports.AnalyzeHandwritingDto = AnalyzeHandwritingDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AnalyzeHandwritingDto.prototype, "image", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AnalyzeHandwritingDto.prototype, "userId", void 0);
let ZiController = ZiController_1 = class ZiController {
    ziService;
    ocrService;
    prisma = new client_1.PrismaClient();
    constructor(ziService, ocrService) {
        this.ziService = ziService;
        this.ocrService = ocrService;
    }
    async analyze(dto) {
        const result = await this.ziService.analyze(dto.zi, dto.handwriting);
        if (dto.userId) {
            try {
                await this.prisma.ziAnalysis.create({
                    data: {
                        userId: dto.userId,
                        zi: dto.zi,
                        pressure: result.handwriting.pressure,
                        pressureInterpretation: result.handwriting.pressureInterpretation,
                        stability: result.handwriting.stability,
                        stabilityInterpretation: result.handwriting.stabilityInterpretation,
                        structure: result.handwriting.structure,
                        structureInterpretation: result.handwriting.structureInterpretation,
                        continuity: result.handwriting.continuity,
                        continuityInterpretation: result.handwriting.continuityInterpretation,
                        overallStyle: result.handwriting.overallStyle,
                        personalityInsights: JSON.stringify(result.handwriting.personalityInsights),
                        interpretation: result.interpretation.overall,
                        coldReadings: JSON.stringify(result.coldReadings),
                        followUpQuestions: JSON.stringify(result.followUpQuestions),
                    },
                });
            }
            catch (error) {
                common_2.Logger.error('保存测字记录失败', error.message, ZiController_1.name);
            }
        }
        return result;
    }
    async recognize(dto) {
        console.log('收到 recognize 请求, dto:', dto);
        const result = await this.ocrService.recognizeHandwriting(dto.image);
        return {
            recognizedZi: result.zi,
            confidence: result.confidence,
        };
    }
    async analyzeHandwriting(dto) {
        try {
            const ocrResult = await this.ocrService.recognizeHandwriting(dto.image);
            const zi = ocrResult.zi;
            if (!zi) {
                return {
                    recognizedZi: null,
                    error: '未能识别出汉字',
                };
            }
            const analysis = await this.ziService.analyze(zi);
            if (dto.userId) {
                try {
                    await this.prisma.ziAnalysis.create({
                        data: {
                            userId: dto.userId,
                            zi,
                            pressure: analysis.handwriting.pressure,
                            pressureInterpretation: analysis.handwriting.pressureInterpretation,
                            stability: analysis.handwriting.stability,
                            stabilityInterpretation: analysis.handwriting.stabilityInterpretation,
                            structure: analysis.handwriting.structure,
                            structureInterpretation: analysis.handwriting.structureInterpretation,
                            continuity: analysis.handwriting.continuity,
                            continuityInterpretation: analysis.handwriting.continuityInterpretation,
                            overallStyle: analysis.handwriting.overallStyle,
                            personalityInsights: JSON.stringify(analysis.handwriting.personalityInsights),
                            interpretation: analysis.interpretation.overall,
                            coldReadings: JSON.stringify(analysis.coldReadings),
                            followUpQuestions: JSON.stringify(analysis.followUpQuestions),
                            confidence: ocrResult.confidence,
                        },
                    });
                }
                catch (error) {
                    common_2.Logger.error('保存测字记录失败', error.message, ZiController_1.name);
                }
            }
            return {
                recognizedZi: zi,
                confidence: ocrResult.confidence,
                analysis,
            };
        }
        catch (error) {
            console.error('analyze-handwriting 错误:', error);
            return {
                recognizedZi: null,
                error: error.message || '服务器错误',
            };
        }
    }
};
exports.ZiController = ZiController;
__decorate([
    (0, common_1.Post)('analyze'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [AnalyzeZiDto]),
    __metadata("design:returntype", Promise)
], ZiController.prototype, "analyze", null);
__decorate([
    (0, common_1.Post)('recognize'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [RecognizeDto]),
    __metadata("design:returntype", Promise)
], ZiController.prototype, "recognize", null);
__decorate([
    (0, common_1.Post)('analyze-handwriting'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [AnalyzeHandwritingDto]),
    __metadata("design:returntype", Promise)
], ZiController.prototype, "analyzeHandwriting", null);
exports.ZiController = ZiController = ZiController_1 = __decorate([
    (0, common_1.Controller)('zi'),
    __metadata("design:paramtypes", [zi_service_1.ZiService,
        ocr_service_1.OcrService])
], ZiController);
//# sourceMappingURL=zi.controller.js.map