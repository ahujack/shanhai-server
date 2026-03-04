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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const sharp_1 = __importDefault(require("sharp"));
let OcrService = OcrService_1 = class OcrService {
    logger = new common_1.Logger(OcrService_1.name);
    SAMPLE_DIR = path.join(process.cwd(), 'handwriting-samples');
    constructor() {
        if (!fs.existsSync(this.SAMPLE_DIR)) {
            fs.mkdirSync(this.SAMPLE_DIR, { recursive: true });
        }
    }
    async recognizeHandwriting(imageBase64) {
        this.logger.log('=== 开始手写识别 ===');
        try {
            const timestamp = Date.now();
            let svgContent = '';
            if (imageBase64.startsWith('<svg')) {
                svgContent = imageBase64;
            }
            else {
                try {
                    svgContent = Buffer.from(imageBase64, 'base64').toString('utf-8');
                }
                catch (e) {
                    this.logger.error('解码失败:', e);
                }
            }
            if (svgContent) {
                const svgPath = path.join(this.SAMPLE_DIR, `input_${timestamp}.svg`);
                fs.writeFileSync(svgPath, svgContent);
                this.logger.log('已保存SVG:', svgPath);
                try {
                    const svgBuffer = Buffer.from(svgContent, 'utf-8');
                    const pngBuffer = await (0, sharp_1.default)(svgBuffer)
                        .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
                        .png()
                        .toBuffer();
                    const pngPath = path.join(this.SAMPLE_DIR, `input_${timestamp}.png`);
                    fs.writeFileSync(pngPath, pngBuffer);
                    this.logger.log('已保存PNG:', pngPath);
                }
                catch (imgError) {
                    this.logger.error('PNG转换失败:', imgError);
                }
            }
            return this.extractFromSvg(imageBase64);
        }
        catch (error) {
            this.logger.error('手写识别失败:', error.message);
            return this.extractFromSvg(imageBase64);
        }
    }
    extractFromSvg(imageBase64) {
        try {
            let svgString = imageBase64;
            if (!imageBase64.startsWith('<svg')) {
                try {
                    svgString = Buffer.from(imageBase64, 'base64').toString('utf-8');
                }
                catch (e) {
                    this.logger.error('base64解码失败:', e);
                }
            }
            const textMatch = svgString.match(/<text[^>]*>([^<]*)<\/text>/);
            if (textMatch && textMatch[1]) {
                const zi = textMatch[1].trim();
                this.logger.log('从SVG提取的文字:', zi);
                return { zi, confidence: 0.95 };
            }
            this.logger.warn('未能从SVG提取到文字');
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