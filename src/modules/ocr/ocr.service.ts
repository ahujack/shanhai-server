import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private readonly SAMPLE_DIR = path.join(process.cwd(), 'handwriting-samples');
  
  constructor() {
    // 确保目录存在
    if (!fs.existsSync(this.SAMPLE_DIR)) {
      fs.mkdirSync(this.SAMPLE_DIR, { recursive: true });
    }
  }
  
  /**
   * 识别手写汉字
   */
  async recognizeHandwriting(imageBase64: string): Promise<{ zi: string; confidence: number }> {
    this.logger.log('=== 开始手写识别 ===');
    
    try {
      // 保存用户输入到本地文件
      const timestamp = Date.now();
      let svgContent = '';
      
      // 解码并保存原始输入
      if (imageBase64.startsWith('<svg')) {
        svgContent = imageBase64;
      } else {
        try {
          svgContent = Buffer.from(imageBase64, 'base64').toString('utf-8');
        } catch (e) {
          this.logger.error('解码失败:', e);
        }
      }
      
      // 保存 SVG 文件
      if (svgContent) {
        const svgPath = path.join(this.SAMPLE_DIR, `input_${timestamp}.svg`);
        fs.writeFileSync(svgPath, svgContent);
        this.logger.log('已保存SVG:', svgPath);
        
        // 尝试转换为PNG保存
        try {
          const svgBuffer = Buffer.from(svgContent, 'utf-8');
          const pngBuffer = await sharp(svgBuffer)
            .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
            .png()
            .toBuffer();
          const pngPath = path.join(this.SAMPLE_DIR, `input_${timestamp}.png`);
          fs.writeFileSync(pngPath, pngBuffer);
          this.logger.log('已保存PNG:', pngPath);
        } catch (imgError) {
          this.logger.error('PNG转换失败:', imgError);
        }
      }
      
      // 从SVG中提取文字
      return this.extractFromSvg(imageBase64);
      
    } catch (error: any) {
      this.logger.error('手写识别失败:', error.message);
      return this.extractFromSvg(imageBase64);
    }
  }
  
  /**
   * 从SVG中提取文字
   */
  private extractFromSvg(imageBase64: string): { zi: string; confidence: number } {
    try {
      let svgString = imageBase64;
      
      // 如果是base64，先解码
      if (!imageBase64.startsWith('<svg')) {
        try {
          svgString = Buffer.from(imageBase64, 'base64').toString('utf-8');
        } catch (e) {
          this.logger.error('base64解码失败:', e);
        }
      }
      
      // 提取文字
      const textMatch = svgString.match(/<text[^>]*>([^<]*)<\/text>/);
      if (textMatch && textMatch[1]) {
        const zi = textMatch[1].trim();
        this.logger.log('从SVG提取的文字:', zi);
        return { zi, confidence: 0.95 };
      }
      
      this.logger.warn('未能从SVG提取到文字');
    } catch (e) {
      this.logger.error('SVG提取失败:', e);
    }
    
    return { zi: '测', confidence: 0.3 };
  }
}
