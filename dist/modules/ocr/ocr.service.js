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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var OcrService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OcrService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const FormData = __importStar(require("form-data"));
let OcrService = OcrService_1 = class OcrService {
    logger = new common_1.Logger(OcrService_1.name);
    API_KEY = process.env.OCR_API_KEY || 'sk-bj2OZEK29RKtXEUR4a93E30f0b664d0c85F665882dCbB69e';
    API_URL = 'https://api.apiyi.com/v1/ocr/handwriting';
    async recognizeHandwriting(imageBase64) {
        try {
            this.logger.log('开始手写识别...');
            const form = new FormData();
            form.append('image', imageBase64);
            form.append('type', 'chinese_handwriting');
            const response = await axios_1.default.post(this.API_URL, form, {
                headers: {
                    'Authorization': `Bearer ${this.API_KEY}`,
                    'Content-Type': 'multipart/form-data',
                },
                timeout: 30000,
            });
            this.logger.log('手写识别响应:', JSON.stringify(response.data));
            if (response.data && response.data.code === 0) {
                const data = response.data.data;
                return {
                    zi: data.text || data.char || '',
                    confidence: data.confidence || 0.9,
                };
            }
            throw new Error(response.data?.message || '识别失败');
        }
        catch (error) {
            this.logger.error('手写识别失败:', error.response?.data || error.message);
            if (error.response?.status === 401) {
                throw new Error('OCR API密钥无效');
            }
            throw new Error(`手写识别失败: ${error.message}`);
        }
    }
    async recognizeFromUrl(imageUrl) {
        try {
            this.logger.log('从URL开始手写识别...');
            const response = await axios_1.default.post(this.API_URL, { image_url: imageUrl, type: 'chinese_handwriting' }, {
                headers: {
                    'Authorization': `Bearer ${this.API_KEY}`,
                    'Content-Type': 'application/json',
                },
                timeout: 30000,
            });
            if (response.data && response.data.code === 0) {
                const data = response.data.data;
                return {
                    zi: data.text || data.char || '',
                    confidence: data.confidence || 0.9,
                };
            }
            throw new Error(response.data?.message || '识别失败');
        }
        catch (error) {
            this.logger.error('从URL识别失败:', error.response?.data || error.message);
            throw new Error(`手写识别失败: ${error.message}`);
        }
    }
};
exports.OcrService = OcrService;
exports.OcrService = OcrService = OcrService_1 = __decorate([
    (0, common_1.Injectable)()
], OcrService);
//# sourceMappingURL=ocr.service.js.map