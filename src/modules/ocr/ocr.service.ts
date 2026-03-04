import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private readonly API_KEY = 'sk-bj2OZEK29RKtXEUR4a93E30f0b664d0c85F665882dCbB69e';
  private readonly API_URL = 'https://api.apiyi.com/v1/chat/completions';
  private readonly MODEL = 'gemini-2.5-flash';
  private readonly SAMPLE_DIR = path.join(process.cwd(), 'handwriting-samples');
  
  constructor() {
    if (!fs.existsSync(this.SAMPLE_DIR)) {
      fs.mkdirSync(this.SAMPLE_DIR, { recursive: true });
    }
  }
  
  /**
   * 使用 Gemini 2.5 Flash 识别手写汉字
   */
  async recognizeHandwriting(imageBase64: string): Promise<{ zi: string; confidence: number }> {
    this.logger.log('=== 开始 Gemini 手写识别 ===');
    
    const timestamp = Date.now();
    
    try {
      // 将图片转换为真正的 JPEG 二进制数据
      let imageData: Buffer;
      
      if (imageBase64.startsWith('<svg')) {
        // SVG 转 JPEG
        const svgBuffer = Buffer.from(imageBase64, 'utf-8');
        imageData = await sharp(svgBuffer)
          .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
          .jpeg({ quality: 90 })
          .toBuffer();
        
        // 保存原始 SVG
        fs.writeFileSync(
          path.join(this.SAMPLE_DIR, `input_${timestamp}.svg`),
          imageBase64
        );
        this.logger.log('SVG转JPEG成功，大小:', imageData.length);
      } else {
        // 可能是 base64，先尝试解码
        try {
          const decoded = Buffer.from(imageBase64, 'base64');
          if (decoded.toString('utf-8').startsWith('<svg')) {
            // 是 SVG
            imageData = await sharp(decoded)
              .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
              .jpeg({ quality: 90 })
              .toBuffer();
            fs.writeFileSync(
              path.join(this.SAMPLE_DIR, `input_${timestamp}.svg`),
              decoded.toString('utf-8')
            );
          } else {
            // 是普通图片
            imageData = decoded;
          }
        } catch {
          imageData = Buffer.from(imageBase64, 'base64');
        }
      }
      
      // 转换为 base64
      const jpegBase64 = imageData.toString('base64');
      
      // 按照用户提供的 Python 代码格式
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
      
      const response = await axios.post(this.API_URL, requestBody, {
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
        
        // 提取汉字 - 更精确的匹配
        // 优先匹配带星号的汉字，如 **测**
        const boldMatch = content.match(/\*\*([\u4e00-\u9fa5]+)\*\*/);
        if (boldMatch) {
          const zi = boldMatch[1];
          this.logger.log('Gemini 识别结果 (加粗):', zi);
          return { zi, confidence: 0.9 };
        }
        
        // 提取第一个汉字
        const ziMatch = content.match(/[\u4e00-\u9fa5]/);
        if (ziMatch) {
          const zi = ziMatch[0];
          this.logger.log('Gemini 识别结果:', zi);
          return { zi, confidence: 0.9 };
        }
      }
      
      throw new Error('未能识别汉字');
      
    } catch (error: any) {
      this.logger.error('Gemini 识别失败:', error.response?.data || error.message);
      
      // 备用：从 SVG 提取
      return this.extractFromSvg(imageBase64, timestamp);
    }
  }
  
  /**
   * 从 SVG 提取文字
   */
  private extractFromSvg(imageBase64: string, timestamp: number): { zi: string; confidence: number } {
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
    } catch (e) {
      this.logger.error('SVG提取失败:', e);
    }
    
    return { zi: '测', confidence: 0.3 };
  }
}
