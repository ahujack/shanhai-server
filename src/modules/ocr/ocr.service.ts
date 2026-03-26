import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import type { HandwritingAnalysis } from '../zi/zi.service';

const execFileAsync = promisify(execFileCb);

/** 与 inferHandwritingTraits 等共用：补全 chat/completions 路径 */
function resolveLlmChatUrl(): string {
  const raw = process.env.LLM_API_URL || process.env.LLM_URL || 'https://api.apiyi.com/v1/chat/completions';
  const t = raw.trim();
  return t.includes('/chat/completions') ? t : `${t.replace(/\/$/, '')}/chat/completions`;
}

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private readonly SAMPLE_DIR = path.join(process.cwd(), 'handwriting-samples');

  /** 百度 access_token 缓存 */
  private baiduToken: { token: string; expiresAt: number } | null = null;

  constructor() {
    if (!fs.existsSync(this.SAMPLE_DIR)) {
      fs.mkdirSync(this.SAMPLE_DIR, { recursive: true });
    }
  }

  /**
   * 识字：可选百度手写（国内快）→ 与 App 相同的 LLM 多模态一次识图 → Paddle → SVG
   * 配置：必填 LLM_API_KEY + LLM_API_URL（与测字多模态一致）；可选 BAIDU_OCR_API_KEY + BAIDU_OCR_SECRET_KEY
   */
  async recognizeHandwriting(imageBase64: string): Promise<{ zi: string; confidence: number }> {
    const timestamp = Date.now();
    try {
      const { buffer, jpegBase64 } = await this.toJpegBuffer(imageBase64, timestamp);

      const baidu = await this.tryBaiduHandwriting(jpegBase64);
      if (baidu?.zi && /[\u4e00-\u9fa5]/.test(baidu.zi)) {
        this.logger.log(`百度手写识字: ${baidu.zi}`);
        return { zi: baidu.zi.charAt(0), confidence: baidu.confidence };
      }

      const llmZi = await this.tryLlmVisionSingleChar(jpegBase64);
      if (llmZi?.zi) {
        return llmZi;
      }

      const paddle = await this.tryPaddleOcr(buffer, timestamp);
      if (paddle?.zi && /[\u4e00-\u9fa5]/.test(paddle.zi)) {
        this.logger.log(`PaddleOCR 识字: ${paddle.zi}`);
        return { zi: paddle.zi.charAt(0), confidence: paddle.confidence };
      }
    } catch (e) {
      this.logger.warn(`识字流程异常: ${(e as Error).message}`);
    }
    return this.extractFromSvg(imageBase64, timestamp);
  }

  /**
   * 多模态笔迹四维度（仍走现有 LLM 配置，可用 LLM_VISION_MODEL 指定较快模型）
   */
  async inferHandwritingTraitsWithGemini(imageBase64: string): Promise<Partial<HandwritingAnalysis> | null> {
    const apiKey = process.env.LLM_API_KEY;
    const apiUrl = resolveLlmChatUrl();
    const model = process.env.LLM_VISION_MODEL || process.env.LLM_MODEL || 'gemini-2.0-flash';
    if (!apiKey) {
      return null;
    }
    const timestamp = Date.now();
    try {
      const { jpegBase64 } = await this.toJpegBuffer(imageBase64, timestamp);
      const timeout = Math.min(90000, Math.max(15000, parseInt(process.env.LLM_VISION_TIMEOUT_MS || '45000', 10)));
      const body = {
        model,
        temperature: 0.2,
        max_tokens: 900,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `你是笔迹心理与书写行为分析师。只看这一张手写汉字图像（可能只有一个字），输出严格 JSON，不要 markdown：
{
  "pressure":"heavy"|"light"|"medium",
  "stability":"stable"|"shaky"|"average",
  "structure":"compact"|"loose"|"balanced",
  "continuity":"connected"|"broken"|"average",
  "pressureInterpretation":"50-120字，描述笔画力度与心理暗示",
  "stabilityInterpretation":"50-120字",
  "structureInterpretation":"50-120字",
  "continuityInterpretation":"50-120字",
  "overallStyle":"20字内概括",
  "personalityInsights":["短语1","短语2","短语3"]
}
必须结合图中真实笔画形态，禁止泛泛套话。`,
              },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${jpegBase64}` },
              },
            ],
          },
        ],
      };
      const res = await axios.post(apiUrl, body, {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: Number.isFinite(timeout) ? timeout : 45000,
      });
      const content = res.data?.choices?.[0]?.message?.content;
      if (!content) return null;
      const raw = String(content).replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return this.normalizeHandwritingTraits(parsed);
    } catch (e) {
      this.logger.warn(`笔迹多模态解读失败: ${(e as Error).message}`);
      return null;
    }
  }

  private normalizeHandwritingTraits(p: Record<string, unknown>): Partial<HandwritingAnalysis> {
    const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
      allowed.includes(v as T) ? (v as T) : fallback;
    const pi = Array.isArray(p.personalityInsights)
      ? (p.personalityInsights as unknown[]).map((x) => String(x)).filter(Boolean).slice(0, 4)
      : [];
    return {
      pressure: pick(p.pressure, ['heavy', 'light', 'medium'] as const, 'medium'),
      stability: pick(p.stability, ['stable', 'shaky', 'average'] as const, 'average'),
      structure: pick(p.structure, ['compact', 'loose', 'balanced'] as const, 'balanced'),
      continuity: pick(p.continuity, ['connected', 'broken', 'average'] as const, 'average'),
      pressureInterpretation: String(p.pressureInterpretation || '').slice(0, 200),
      stabilityInterpretation: String(p.stabilityInterpretation || '').slice(0, 200),
      structureInterpretation: String(p.structureInterpretation || '').slice(0, 200),
      continuityInterpretation: String(p.continuityInterpretation || '').slice(0, 200),
      overallStyle: String(p.overallStyle || '多模态笔迹观察').slice(0, 80),
      personalityInsights: pi.length ? pi : ['细致', '有想法'],
    };
  }

  private async toJpegBuffer(
    imageBase64: string,
    timestamp: number,
  ): Promise<{ buffer: Buffer; jpegBase64: string }> {
    let imageData: Buffer;
    if (imageBase64.startsWith('<svg')) {
      const svgBuffer = Buffer.from(imageBase64, 'utf-8');
      fs.writeFileSync(path.join(this.SAMPLE_DIR, `input_${timestamp}.svg`), imageBase64);
      imageData = await sharp(svgBuffer)
        .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
        .jpeg({ quality: 85 })
        .toBuffer();
    } else {
      try {
        const decoded = Buffer.from(imageBase64, 'base64');
        if (decoded.toString('utf-8').startsWith('<svg')) {
          imageData = await sharp(decoded)
            .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
            .jpeg({ quality: 85 })
            .toBuffer();
        } else {
          imageData = await sharp(decoded)
            .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
            .jpeg({ quality: 85 })
            .toBuffer();
        }
      } catch {
        imageData = await sharp(Buffer.from(imageBase64, 'base64'))
          .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255 } })
          .jpeg({ quality: 85 })
          .toBuffer();
      }
    }
    return { buffer: imageData, jpegBase64: imageData.toString('base64') };
  }

  /** 百度手写文字识别（国内延迟低，专 OCR） */
  private async tryBaiduHandwriting(jpegBase64: string): Promise<{ zi: string; confidence: number } | null> {
    const apiKey = process.env.BAIDU_OCR_API_KEY?.trim();
    const secret = process.env.BAIDU_OCR_SECRET_KEY?.trim();
    if (!apiKey || !secret) return null;

    const timeout = 12000;
    try {
      const token = await this.getBaiduAccessToken(apiKey, secret, timeout);
      if (!token) return null;

      const form = new URLSearchParams();
      form.set('image', jpegBase64);
      form.set('detect_direction', 'false');

      const res = await axios.post(
        `https://aip.baidubce.com/rest/2.0/ocr/v1/handwriting?access_token=${encodeURIComponent(token)}`,
        form.toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: Number.isFinite(timeout) ? timeout : 12000,
        },
      );

      if (res.data?.error_code) {
        this.logger.warn(`百度OCR错误: ${res.data.error_code} ${res.data.error_msg}`);
        return null;
      }

      const results = res.data?.words_result as Array<{ words?: string; probability?: number }> | undefined;
      if (!Array.isArray(results) || !results.length) return null;

      const text = results.map((r) => r.words || '').join('').trim();
      const m = text.match(/[\u4e00-\u9fa5]/);
      if (!m) return null;

      const prob = results[0]?.probability;
      const confidence =
        typeof prob === 'number' && prob <= 1 ? prob : typeof prob === 'number' ? prob / 100 : 0.9;
      return { zi: m[0], confidence: Math.min(0.99, Math.max(0.5, confidence)) };
    } catch (e) {
      this.logger.warn(`百度手写识字失败: ${(e as Error).message}`);
      return null;
    }
  }

  private async getBaiduAccessToken(apiKey: string, secret: string, timeout: number): Promise<string | null> {
    const now = Date.now();
    if (this.baiduToken && this.baiduToken.expiresAt > now + 60_000) {
      return this.baiduToken.token;
    }
    try {
      const url =
        `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials` +
        `&client_id=${encodeURIComponent(apiKey)}&client_secret=${encodeURIComponent(secret)}`;
      const res = await axios.get(url, { timeout: Number.isFinite(timeout) ? timeout : 12000 });
      const token = res.data?.access_token as string | undefined;
      const expiresIn = Number(res.data?.expires_in) || 2592000;
      if (!token) return null;
      this.baiduToken = { token, expiresAt: now + expiresIn * 1000 };
      return token;
    } catch (e) {
      this.logger.warn(`百度 token 获取失败: ${(e as Error).message}`);
      return null;
    }
  }

  /** 与 LLM_MODEL 同源一次识图（低 detail、少 token，避免重复调两次） */
  private async tryLlmVisionSingleChar(jpegBase64: string): Promise<{ zi: string; confidence: number } | null> {
    const apiKey = process.env.LLM_API_KEY?.trim();
    if (!apiKey) return null;

    const apiUrl = resolveLlmChatUrl();
    const model = process.env.LLM_OCR_MODEL?.trim() || process.env.LLM_MODEL?.trim() || 'gemini-2.0-flash';
    const timeout = Math.min(60000, Math.max(12000, parseInt(process.env.LLM_OCR_TIMEOUT_MS || '28000', 10)));

    const body = {
      model,
      temperature: 0,
      max_tokens: 12,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '图中只有一个手写汉字。只回复这个字本身，不要空格、标点或其它字。',
            },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${jpegBase64}` },
            },
          ],
        },
      ],
    };

    try {
      const response = await axios.post(apiUrl, body, {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: Number.isFinite(timeout) ? timeout : 28000,
      });
      if (response.data?.error) {
        this.logger.warn(`LLM 识字 API 错误: ${JSON.stringify(response.data.error)}`);
        return null;
      }
      const content = response.data?.choices?.[0]?.message?.content as string | undefined;
      if (!content) return null;
      const m = content.match(/[\u4e00-\u9fa5]/);
      if (m) {
        this.logger.log(`LLM 识字(${model}): ${m[0]}`);
        return { zi: m[0], confidence: 0.88 };
      }
    } catch (e) {
      this.logger.warn(`LLM 识字失败: ${(e as Error).message}`);
    }
    return null;
  }

  private async tryPaddleOcr(
    buffer: Buffer,
    timestamp: number,
  ): Promise<{ zi: string; confidence: number } | null> {
    if (process.env.PADDLE_OCR_ENABLED !== 'true') {
      return null;
    }
    const script =
      process.env.PADDLE_OCR_SCRIPT || path.join(process.cwd(), 'scripts', 'paddle_ocr_char.py');
    const python = process.env.PADDLE_OCR_PYTHON || 'python3';
    if (!fs.existsSync(script)) {
      this.logger.warn(`Paddle 脚本不存在: ${script}`);
      return null;
    }
    const tmp = path.join(this.SAMPLE_DIR, `paddle_${timestamp}.jpg`);
    fs.writeFileSync(tmp, buffer);
    const execTimeout = Math.min(120000, Math.max(8000, parseInt(process.env.PADDLE_OCR_TIMEOUT_MS || '60000', 10)));
    try {
      const { stdout } = await execFileAsync(python, [script, tmp], {
        timeout: Number.isFinite(execTimeout) ? execTimeout : 60000,
        maxBuffer: 12 * 1024 * 1024,
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
      });
      const j = JSON.parse(stdout.trim()) as { zi?: string; confidence?: number };
      if (j.zi && /[\u4e00-\u9fa5]/.test(j.zi)) {
        return { zi: j.zi.charAt(0), confidence: typeof j.confidence === 'number' ? j.confidence : 0.88 };
      }
    } catch (e) {
      this.logger.warn(`PaddleOCR 子进程失败: ${(e as Error).message}`);
    } finally {
      try {
        fs.unlinkSync(tmp);
      } catch {
        /* ignore */
      }
    }
    return null;
  }

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
