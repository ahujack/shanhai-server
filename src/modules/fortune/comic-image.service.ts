import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import type { FortuneComic, FortuneComicPanel } from './fortune.service';

/** 道观场景文生图：MiniMax image-01 + 本地缓存，避免每本漫重复计费 */
@Injectable()
export class ComicImageService {
  private readonly logger = new Logger(ComicImageService.name);
  private readonly cacheDir = path.join(process.cwd(), 'public', 'comic-cache');
  private readonly inflight = new Map<string, Promise<string | undefined>>();

  isEnabled() {
    return (
      /^(1|true|yes|on)$/i.test(String(process.env.COMIC_IMAGE_ENABLED || '').trim()) &&
      Boolean(String(process.env.MINIMAX_API_KEY || '').trim())
    );
  }

  async attachImages(comic: FortuneComic): Promise<FortuneComic> {
    if (!this.isEnabled()) return comic;

    fs.mkdirSync(this.cacheDir, { recursive: true });
    const publicBase = this.publicBase();

    const coverKey = `cover_${this.hash(`${comic.poemTitle}_${comic.rank}_${comic.companion.id}`)}`;
    const uniqueVisuals = [...new Set(comic.panels.map((p) => p.visual || 'path'))];

    // 封面 + 去重场景并行生成；同场景只计费一次
    const [coverPath, ...scenePaths] = await Promise.all([
      this.ensureImage(coverKey, this.coverPrompt(comic)),
      ...uniqueVisuals.map((visual) =>
        this.ensureImage(`scene_${visual}`, this.scenePrompt(visual, comic)),
      ),
    ]);

    const sceneMap = new Map(uniqueVisuals.map((visual, i) => [visual, scenePaths[i]]));
    const panels: FortuneComicPanel[] = comic.panels.map((panel) => {
      const rel = sceneMap.get(panel.visual || 'path');
      return {
        ...panel,
        imageUrl: rel ? `${publicBase}${rel}` : undefined,
      };
    });

    return {
      ...comic,
      coverImageUrl: coverPath ? `${publicBase}${coverPath}` : undefined,
      panels,
    };
  }

  private publicBase() {
    return String(
      process.env.PUBLIC_API_ORIGIN ||
        process.env.FRONTEND_API_ORIGIN ||
        'https://shanhai-production.up.railway.app',
    ).replace(/\/$/, '');
  }

  private async ensureImage(cacheKey: string, prompt: string): Promise<string | undefined> {
    const fileName = `${cacheKey}.png`;
    const abs = path.join(this.cacheDir, fileName);
    const publicPath = `/comic-cache/${fileName}`;
    if (fs.existsSync(abs) && fs.statSync(abs).size > 1024) return publicPath;

    const existing = this.inflight.get(cacheKey);
    if (existing) return existing;

    const job = this.generateAndSave(cacheKey, abs, publicPath, prompt);
    this.inflight.set(cacheKey, job);
    try {
      return await job;
    } finally {
      this.inflight.delete(cacheKey);
    }
  }

  private async generateAndSave(
    cacheKey: string,
    abs: string,
    publicPath: string,
    prompt: string,
  ): Promise<string | undefined> {
    try {
      const buffer = await this.generatePng(prompt);
      if (!buffer?.length) return undefined;
      fs.writeFileSync(abs, buffer);
      this.logger.log(`条漫配图已缓存: ${cacheKey} (${buffer.length} bytes)`);
      return publicPath;
    } catch (err) {
      this.logger.warn(`条漫配图失败[${cacheKey}]: ${(err as Error).message}`);
      return undefined;
    }
  }

  private async generatePng(prompt: string): Promise<Buffer | undefined> {
    const apiKey = String(process.env.MINIMAX_API_KEY || '').trim();
    const base = String(process.env.MINIMAX_API_BASE || 'https://api.minimax.io').replace(/\/$/, '');
    const model = String(process.env.COMIC_IMAGE_MODEL || 'image-01').trim();

    const res = await axios.post(
      `${base}/v1/image_generation`,
      {
        model,
        prompt: prompt.slice(0, 1400),
        aspect_ratio: '3:4',
        response_format: 'base64',
        n: 1,
        prompt_optimizer: true,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      },
    );

    const data = res.data?.data || res.data;
    const first =
      data?.image_base64?.[0] ||
      data?.images?.[0]?.base64 ||
      data?.image_base64 ||
      data?.data?.[0]?.b64_json;

    if (typeof first === 'string' && first.length > 64) {
      const pure = first.replace(/^data:image\/\w+;base64,/, '');
      return Buffer.from(pure, 'base64');
    }

    const url =
      data?.image_urls?.[0] ||
      data?.images?.[0]?.url ||
      data?.data?.[0]?.url ||
      res.data?.image_urls?.[0];
    if (typeof url === 'string' && url.startsWith('http')) {
      const img = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });
      return Buffer.from(img.data);
    }

    this.logger.warn(`MiniMax 返回无法解析: ${JSON.stringify(res.data).slice(0, 400)}`);
    return undefined;
  }

  private stylePrefix() {
    return [
      'Chinese ink wash illustration, vertical webtoon panel,',
      'Jiangnan Taoist temple atmosphere, soft paper texture,',
      'muted grey-green mountains, cinnabar accents, no text, no watermark, no logo,',
      'cinematic composition, refined low-poly-inspired stylized painting',
    ].join(' ');
  }

  private scenePrompt(visual: string, comic: FortuneComic) {
    const scenes: Record<string, string> = {
      gate: 'ancient Chinese temple mountain gate with flying eaves at dawn mist',
      hall: 'main hall of Taoist temple Sanqing, red pillars white walls tile roof',
      incense: 'bronze incense burner with rising smoke in temple courtyard',
      pine: 'ink-wash pine trees beside temple stone path',
      mist: 'distant layered mountains in fog, literati landscape',
      cushion: 'meditation cushion on stone floor inside quiet hall',
      night: 'temple courtyard at night with warm lantern glow',
      wish: 'ginkgo wish tree with red ribbons in courtyard',
      path: 'stone corridor with railings leading toward temple hall',
    };
    return `${this.stylePrefix()}, ${scenes[visual] || scenes.path}, mood inspired by fortune "${comic.poemTitle}"`;
  }

  private coverPrompt(comic: FortuneComic) {
    return `${this.stylePrefix()}, cover of a webtoon about a Taoist temple reading, title mood "${comic.poemTitle}", ${comic.rank}, elegant vertical poster, companion storyteller silhouette in robe, dramatic soft light`;
  }

  private hash(input: string) {
    let h = 0;
    for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
    return h.toString(16).padStart(8, '0');
  }
}
