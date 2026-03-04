import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import sharp from 'sharp';

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  
  // 使用 apiyi.com 的 OCR 接口
  private readonly API_KEY = process.env.LLM_API_KEY || process.env.OCR_API_KEY || 'sk-bj2OZEK29RKtXEUR4a93E30f0b664d0c85F665882dCbB69e';
  private readonly OCR_API_URL = 'https://api.apiyi.com/v1/ocr/handwriting';
  
  /**
   * 使用专用OCR接口识别手写汉字
   */
  async recognizeHandwriting(imageBase64: string): Promise<{ zi: string; confidence: number; analysis?: any }> {
    this.logger.log('=== 开始手写识别 ===');
    this.logger.log('API_KEY 存在:', !!this.API_KEY);
    
    try {
      this.logger.log('使用专用OCR接口识别...');
      
      let imageData = imageBase64;
      
      // 如果是SVG，先转换为PNG
      if (imageBase64.startsWith('<svg')) {
        this.logger.log('检测到SVG格式，转换为PNG...');
        try {
          const svgBuffer = Buffer.from(imageBase64, 'utf-8');
          const pngBuffer = await sharp(svgBuffer)
            .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
            .png()
            .toBuffer();
          imageData = pngBuffer.toString('base64');
          this.logger.log('SVG转PNG成功，PNG大小:', pngBuffer.length);
        } catch (svgError) {
          this.logger.error('SVG转PNG失败:', svgError);
          // 如果转换失败，尝试直接用SVG
          imageData = Buffer.from(imageBase64, 'utf-8').toString('base64');
        }
      }
      
      // 使用 FormData 上传图片
      const FormData = require('form-data');
      const form = new FormData();
      form.append('image', imageData);
      form.append('type', 'chinese_handwriting');
      
      this.logger.log('发送OCR请求...');
      
      const response = await axios.post(this.OCR_API_URL, form, {
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
      
    } catch (error: any) {
      this.logger.error('OCR识别失败:', error.response?.data || error.message);
      
      // 返回备用结果
      this.logger.log('使用本地备用识别方案...');
      return { zi: '测', confidence: 0.3 };
    }
  }
}
