import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import FormData from 'form-data';

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  
  // 聚合API手写识别API配置
  private readonly API_KEY = process.env.OCR_API_KEY || 'sk-bj2OZEK29RKtXEUR4a93E30f0b664d0c85F665882dCbB69e';
  private readonly API_URL = 'https://api.apiyi.com/v1/ocr/handwriting';
  
  /**
   * 识别手写汉字图片
   * @param imageBase64 图片的base64编码或SVG字符串
   * @returns 识别出的汉字
   */
  async recognizeHandwriting(imageBase64: string): Promise<{ zi: string; confidence: number }> {
    try {
      this.logger.log('开始手写识别...');
      
      // 如果是SVG字符串，先转换为base64
      let base64Data = imageBase64;
      if (imageBase64.startsWith('<svg')) {
        base64Data = Buffer.from(imageBase64, 'utf-8').toString('base64');
      }
      
      // 构建请求
      const form = new FormData();
      form.append('image', base64Data);
      form.append('type', 'chinese_handwriting');
      
      const response = await axios.post(this.API_URL, form, {
        headers: {
          'Authorization': `Bearer ${this.API_KEY}`,
          ...form.getHeaders(),
        },
        timeout: 30000,
      });
      
      this.logger.log('手写识别响应:', JSON.stringify(response.data));
      
      // 解析响应 - 根据聚合API的返回格式
      if (response.data && response.data.code === 0) {
        const data = response.data.data;
        return {
          zi: data.text || data.char || '',
          confidence: data.confidence || 0.9,
        };
      }
      
      throw new Error(response.data?.message || '识别失败');
    } catch (error) {
      this.logger.error('手写识别失败:', error.response?.data || error.message);
      
      // 如果API调用失败，尝试使用备用方案或返回错误
      if (error.response?.status === 401) {
        throw new Error('OCR API密钥无效');
      }
      
      throw new Error(`手写识别失败: ${error.message}`);
    }
  }
  
  /**
   * 识别手写汉字图片 (URL方式)
   * @param imageUrl 图片的URL
   * @returns 识别出的汉字
   */
  async recognizeFromUrl(imageUrl: string): Promise<{ zi: string; confidence: number }> {
    try {
      this.logger.log('从URL开始手写识别...');
      
      const response = await axios.post(
        this.API_URL,
        { image_url: imageUrl, type: 'chinese_handwriting' },
        {
          headers: {
            'Authorization': `Bearer ${this.API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );
      
      if (response.data && response.data.code === 0) {
        const data = response.data.data;
        return {
          zi: data.text || data.char || '',
          confidence: data.confidence || 0.9,
        };
      }
      
      throw new Error(response.data?.message || '识别失败');
    } catch (error) {
      this.logger.error('从URL识别失败:', error.response?.data || error.message);
      throw new Error(`手写识别失败: ${error.message}`);
    }
  }
}
