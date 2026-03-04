"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var OcrService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OcrService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const sharp_1 = __importDefault(require("sharp"));
let OcrService = OcrService_1 = class OcrService {
    logger = new common_1.Logger(OcrService_1.name);
    API_KEY = process.env.LLM_API_KEY || process.env.OCR_API_KEY || 'sk-bj2OZEK29RKtXEUR4a93E30f0b664d0c85F665882dCbB69e';
    OCR_API_URL = 'https://api.apiyi.com/v1/ocr/handwriting';
    async recognizeHandwriting(imageBase64) {
        this.logger.log('=== 开始手写识别 ===');
        this.logger.log('API_KEY 存在:', !!this.API_KEY);
        try {
            this.logger.log('使用专用OCR接口识别...');
            let imageData = imageBase64;
            if (imageBase64.startsWith('<svg')) {
                this.logger.log('检测到SVG格式，转换为PNG...');
                try {
                    const svgBuffer = Buffer.from(imageBase64, 'utf-8');
                    const pngBuffer = await (0, sharp_1.default)(svgBuffer)
                        .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
                        .png()
                        .toBuffer();
                    imageData = pngBuffer.toString('base64');
                    this.logger.log('SVG转PNG成功，PNG大小:', pngBuffer.length);
                }
                catch (svgError) {
                    this.logger.error('SVG转PNG失败:', svgError);
                    imageData = Buffer.from(imageBase64, 'utf-8').toString('base64');
                }
            }
            const FormData = require('form-data');
            const form = new FormData();
            form.append('image', imageData);
            form.append('type', 'chinese_handwriting');
            this.logger.log('发送OCR请求...');
            const response = await axios_1.default.post(this.OCR_API_URL, form, {
                headers: {
                    'Authorization': `Bearer ${this.API_KEY}`,
                    ...form.getHeaders(),
                },
                timeout: 30000,
            });
            this.logger.log('OCR响应:', JSON.stringify(response.data));
            if (response.data && response.data.code === 0) {
                const data = response.data.data;
                return {
                    zi: data.text || data.char || '',
                    confidence: data.confidence || 0.9,
                };
            }
            throw new Error(response.data?.message || 'OCR识别失败');
        }
        catch (error) {
            this.logger.error('OCR识别失败:', error.response?.data || error.message);
            this.logger.log('使用本地备用识别方案...');
            return { zi: '测', confidence: 0.3 };
        }
    }
};
exports.OcrService = OcrService;
exports.OcrService = OcrService = OcrService_1 = __decorate([
    (0, common_1.Injectable)()
], OcrService);
//# sourceMappingURL=ocr.service.js.map