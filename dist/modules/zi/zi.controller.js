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
exports.ZiController = exports.AnalyzeHandwritingDto = exports.RecognizeDto = exports.AnalyzeZiDto = void 0;
const common_1 = require("@nestjs/common");
const zi_service_1 = require("./zi.service");
const ocr_service_1 = require("../ocr/ocr.service");
class AnalyzeZiDto {
    zi;
    handwriting;
}
exports.AnalyzeZiDto = AnalyzeZiDto;
class RecognizeDto {
    image;
}
exports.RecognizeDto = RecognizeDto;
class AnalyzeHandwritingDto {
    image;
}
exports.AnalyzeHandwritingDto = AnalyzeHandwritingDto;
let ZiController = class ZiController {
    ziService;
    ocrService;
    constructor(ziService, ocrService) {
        this.ziService = ziService;
        this.ocrService = ocrService;
    }
    async analyze(dto) {
        return this.ziService.analyze(dto.zi, dto.handwriting);
    }
    async recognize(dto) {
        const result = await this.ocrService.recognizeHandwriting(dto.image);
        return {
            recognizedZi: result.zi,
            confidence: result.confidence,
        };
    }
    async analyzeHandwriting(dto) {
        const ocrResult = await this.ocrService.recognizeHandwriting(dto.image);
        const zi = ocrResult.zi;
        if (!zi) {
            return {
                recognizedZi: null,
                error: '未能识别出汉字',
            };
        }
        const analysis = await this.ziService.analyze(zi);
        return {
            recognizedZi: zi,
            confidence: ocrResult.confidence,
            analysis,
        };
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
exports.ZiController = ZiController = __decorate([
    (0, common_1.Controller)('zi'),
    __metadata("design:paramtypes", [zi_service_1.ZiService,
        ocr_service_1.OcrService])
], ZiController);
//# sourceMappingURL=zi.controller.js.map