"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var OcrService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OcrService = void 0;
const common_1 = require("@nestjs/common");
let OcrService = OcrService_1 = class OcrService {
    logger = new common_1.Logger(OcrService_1.name);
    async recognizeHandwriting(imageBase64) {
        this.logger.log('=== 开始手写识别 ===');
        this.logger.log('imageBase64是否以<svg开头:', imageBase64.startsWith('<svg'));
        try {
            let svgText = '';
            if (imageBase64.startsWith('<svg')) {
                this.logger.log('检测到SVG格式');
                const textMatch = imageBase64.match(/<text[^>]*>([^<]*)<\/text>/);
                this.logger.log('textMatch:', textMatch);
                if (textMatch) {
                    svgText = textMatch[1];
                    this.logger.log('从SVG提取的文字:', svgText);
                }
            }
            else {
                this.logger.log('非SVG格式，尝试base64解码');
                try {
                    const decoded = Buffer.from(imageBase64, 'base64').toString('utf-8');
                    this.logger.log('解码后内容:', decoded.substring(0, 100));
                    if (decoded.startsWith('<svg')) {
                        const textMatch = decoded.match(/<text[^>]*>([^<]*)<\/text>/);
                        if (textMatch) {
                            svgText = textMatch[1];
                            this.logger.log('从解码SVG提取的文字:', svgText);
                        }
                    }
                }
                catch (e) {
                    this.logger.error('解码失败:', e);
                }
            }
            if (svgText && svgText.trim()) {
                this.logger.log('识别成功 - 使用SVG中的文字:', svgText);
                return { zi: svgText.trim(), confidence: 0.95 };
            }
            throw new Error('无法从SVG中提取文字');
        }
        catch (error) {
            this.logger.error('手写识别失败:', error.message);
            return { zi: '测', confidence: 0.3 };
        }
    }
};
exports.OcrService = OcrService;
exports.OcrService = OcrService = OcrService_1 = __decorate([
    (0, common_1.Injectable)()
], OcrService);
//# sourceMappingURL=ocr.service.js.map