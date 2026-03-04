"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
let OcrService = OcrService_1 = class OcrService {
    logger = new common_1.Logger(OcrService_1.name);
    API_KEY = 'sk-bj2OZEK29RKtXEUR4a93E30f0b664d0c85F665882dCbB69e';
    API_URL = 'https://api.apiyi.com/v1/chat/completions';
    MODEL = 'gemini-2.5-flash';
    SAMPLE_DIR = path.join(process.cwd(), 'handwriting-samples');
    constructor() {
        if (!fs.existsSync(this.SAMPLE_DIR)) {
            fs.mkdirSync(this.SAMPLE_DIR, { recursive: true });
        }
    }
    async recognizeHandwriting(imageBase64) {
        this.logger.log('=== 开始 Gemini 手写识别 ===');
        const timestamp = Date.now();
        try {
            let imageData;
            let isSvg = false;
            if (imageBase64.startsWith('<svg')) {
                isSvg = true;
                const svgBuffer = Buffer.from(imageBase64, 'utf-8');
                fs.writeFileSync(path.join(this.SAMPLE_DIR, `input_${timestamp}.svg`), imageBase64);
                imageData = await (0, sharp_1.default)(svgBuffer)
                    .resize(256, 256, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
                    .jpeg({ quality: 60, mozjpeg: true })
                    .toBuffer();
                this.logger.log('SVG转压缩JPEG成功，大小:', imageData.length);
            }
            else {
                try {
                    const decoded = Buffer.from(imageBase64, 'base64');
                    if (decoded.toString('utf-8').startsWith('<svg')) {
                        isSvg = true;
                        imageData = await (0, sharp_1.default)(decoded)
                            .resize(256, 256, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
                            .jpeg({ quality: 60, mozjpeg: true })
                            .toBuffer();
                        fs.writeFileSync(path.join(this.SAMPLE_DIR, `input_${timestamp}.svg`), decoded.toString('utf-8'));
                    }
                    else {
                        imageData = await (0, sharp_1.default)(decoded)
                            .resize(256, 256, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
                            .jpeg({ quality: 60, mozjpeg: true })
                            .toBuffer();
                    }
                }
                catch {
                    imageData = await (0, sharp_1.default)(Buffer.from(imageBase64, 'base64'))
                        .resize(256, 256, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
                        .jpeg({ quality: 60, mozjpeg: true })
                        .toBuffer();
                }
            }
            const jpegBase64 = imageData.toString('base64');
            this.logger.log('最终图片base64长度:', jpegBase64.length);
            const requestBody = {
                model: this.MODEL,
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: '分析这张图片中的所有文字内容'
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:image/jpeg;base64,${jpegBase64}`
                                }
                            }
                        ]
                    }
                ]
            };
            this.logger.log('发送 Gemini 请求...');
            const response = await axios_1.default.post(this.API_URL, requestBody, {
                headers: {
                    'Authorization': `Bearer ${this.API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 90000,
            });
            this.logger.log('Gemini 响应:', JSON.stringify(response.data));
            if (response.data?.choices?.[0]?.message?.content) {
                const content = response.data.choices[0].message.content;
                this.logger.log('Gemini 返回内容:', content);
                const boldMatch = content.match(/\*\*[^\n]*?([\u4e00-\u9fa5])[^\n]*?\*\*/);
                if (boldMatch) {
                    const zi = boldMatch[1];
                    this.logger.log('Gemini 识别结果 (加粗):', zi);
                    return { zi, confidence: 0.9 };
                }
                const hanziMatch = content.match(/汉字[：:]\s*([\u4e00-\u9fa5])/);
                if (hanziMatch) {
                    const zi = hanziMatch[1];
                    this.logger.log('Gemini 识别结果 (汉字:):', zi);
                    return { zi, confidence: 0.9 };
                }
                const numberedMatch = content.match(/(?:^|\n)\s*\d+\.?\s*([\u4e00-\u9fa5])/);
                if (numberedMatch) {
                    const zi = numberedMatch[1];
                    this.logger.log('Gemini 识别结果 (编号):', zi);
                    return { zi, confidence: 0.9 };
                }
                const parenMatch = content.match(/\(([\u4e00-\u9fa5])\s*[a-zA-Z]+\)/);
                if (parenMatch) {
                    const zi = parenMatch[1];
                    this.logger.log('Gemini 识别结果 (拼音):', zi);
                    return { zi, confidence: 0.9 };
                }
                const ziMatch = content.match(/[\u4e00-\u9fa5]/);
                if (ziMatch) {
                    const zi = ziMatch[0];
                    this.logger.log('Gemini 识别结果:', zi);
                    return { zi, confidence: 0.9 };
                }
            }
            throw new Error('未能识别汉字');
        }
        catch (error) {
            this.logger.error('Gemini 识别失败:', error.response?.data || error.message);
            return this.extractFromSvg(imageBase64, timestamp);
        }
    }
    extractFromSvg(imageBase64, timestamp) {
        try {
            let svgString = imageBase64;
            if (!imageBase64.startsWith('<svg')) {
                svgString = Buffer.from(imageBase64, 'base64').toString('utf-8');
            }
            const textMatch = svgString.match(/<text[^>]*>([^<]*)<\/text>/);
            if (textMatch && textMatch[1]) {
                const zi = textMatch[1].trim();
                this.logger.log('备用方案 - 从SVG提取:', zi);
                return { zi, confidence: 0.95 };
            }
        }
        catch (e) {
            this.logger.error('SVG提取失败:', e);
        }
        return { zi: '测', confidence: 0.3 };
    }
};
exports.OcrService = OcrService;
exports.OcrService = OcrService = OcrService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], OcrService);
//# sourceMappingURL=ocr.service.js.map