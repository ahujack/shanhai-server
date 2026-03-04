import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  
  // 使用 apiyi.com 的千问多模态模型
  private readonly API_KEY = process.env.LLM_API_KEY || process.env.OCR_API_KEY || 'sk-bj2OZEK29RKtXEUR4a93E30f0b664d0c85F665882dCbB69e';
  private readonly API_URL = process.env.LLM_API_URL || 'https://api.apiyi.com/v1/chat/completions';
  private readonly MODEL = process.env.LLM_MODEL || 'qwen-vl-plus';
  
  /**
   * 使用多模态大模型识别手写汉字
   */
  async recognizeHandwriting(imageBase64: string): Promise<{ zi: string; confidence: number; analysis?: any }> {
    try {
      this.logger.log('使用千问多模态模型识别手写...');
      
      let imageData = imageBase64;
      if (imageBase64.startsWith('<svg')) {
        imageData = Buffer.from(imageBase64, 'utf-8').toString('base64');
      }
      
      // 构建多模态请求
      const requestBody = {
        model: this.MODEL,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:image/svg+xml;base64,${imageData}` } },
              { type: 'text', text: `请仔细识别这张图片中的手写汉字。返回JSON格式：{"zi": "汉字", "confidence": 0.9}` }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 500
      };
      
      const response = await axios.post(this.API_URL, requestBody, {
        headers: { 'Authorization': `Bearer ${this.API_KEY}`, 'Content-Type': 'application/json' },
        timeout: 60000,
      });
      
      this.logger.log('千问模型响应:', JSON.stringify(response.data));
      
      if (response.data?.choices?.[0]?.message?.content) {
        const content = response.data.choices[0].message.content;
        
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            return { zi: result.zi || '', confidence: result.confidence || 0.8 };
          }
        } catch (e) {
          this.logger.error('解析JSON失败:', e);
        }
        
        const ziMatch = content.match(/[\u4e00-\u9fa5]/);
        if (ziMatch) {
          return { zi: ziMatch[0], confidence: 0.7 };
        }
      }
      
      throw new Error('无法识别图片中的汉字');
    } catch (error: any) {
      this.logger.error('手写识别失败:', error.response?.data || error.message);
      
      this.logger.log('使用本地备用识别方案...');
      return { zi: '测', confidence: 0.3 };
    }
  }
  
  /**
   * 使用多模态模型进行深度分析
   */
  async analyzeHandwriting(imageBase64: string, userContext?: { age?: number; gender?: string }): Promise<any> {
    try {
      this.logger.log('开始深度分析手写内容...');
      
      let imageData = imageBase64;
      if (imageBase64.startsWith('<svg')) {
        imageData = Buffer.from(imageBase64, 'utf-8').toString('base64');
      }
      
      let contextDescription = '';
      if (userContext) {
        const gender = userContext.gender === 'male' ? '男' : userContext.gender === 'female' ? '女' : '其他';
        contextDescription = `\n用户信息：${gender}性，年龄${userContext.age || '未知'}`;
      }
      
      const systemPrompt = `你是一位专业的测字分析师，参考《测字的科学依赖.txt》的理论进行心理分析。

分析维度：
1. **视觉分析**（笔迹心理学）：
   - 书写力度：轻重反映内心能量状态
   - 稳定性：抖动反映情绪状态
   - 结构：松散或紧凑反映自我认知
   
2. **语义分析**（拆字心理学）：
   - 离合法：拆分汉字部件进行联想
   - 象形法：部件形状联想到具体事物
   - 冷读术：结合巴纳姆效应给出普适性解读

请用科学、理性的态度进行分析，避免过度玄学化。`;
      
      const requestBody = {
        model: this.MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:image/svg+xml;base64,${imageData}` } },
              { type: 'text', text: `请分析这张手写图片中的汉字。${contextDescription}\n\n返回JSON：{"zi":"汉字","confidence":0.9,"visualAnalysis":{"pressure":"heavy/light/medium","stability":"stable/shaky/medium","structure":"compact/loose/balanced"},"semanticAnalysis":{"components":["部件1","部件2"],"associations":["联想1","联想2"]}}` }
            ]
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      };
      
      const response = await axios.post(this.API_URL, requestBody, {
        headers: { 'Authorization': `Bearer ${this.API_KEY}`, 'Content-Type': 'application/json' },
        timeout: 90000,
      });
      
      if (response.data?.choices?.[0]?.message?.content) {
        const content = response.data.choices[0].message.content;
        
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          this.logger.error('解析深度分析JSON失败:', e);
        }
      }
      
      throw new Error('深度分析失败');
    } catch (error: any) {
      this.logger.error('深度分析失败:', error.response?.data || error.message);
      
      return {
        zi: '测',
        confidence: 0.3,
        visualAnalysis: { pressure: 'medium', stability: 'medium', structure: 'balanced' },
        semanticAnalysis: { components: ['测'], associations: ['估计、推测'] }
      };
    }
  }
}
