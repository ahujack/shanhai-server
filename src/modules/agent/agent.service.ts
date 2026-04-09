import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import FormData from 'form-data';
import tencentcloud from 'tencentcloud-sdk-nodejs';
import { PrismaClient } from '@prisma/client';
import { PersonaService, PersonaSchema } from '../persona/persona.service';
import { ReadingService, DivinationCategory } from '../reading/reading.service';
import { FortuneService } from '../fortune/fortune.service';
import { ChartService } from '../chart/chart.service';
import { AgentChatDto } from './dto/agent-chat.dto';

type AgentIntent = 'chat' | 'divination' | 'meditation' | 'chart' | 'fortune' | 'zi';
type AgentAction = { type: string; label: string };

function resolveSttTranscriptionsUrl(): string {
  const raw =
    process.env.LLM_STT_API_URL ||
    process.env.STT_API_URL ||
    process.env.LLM_API_URL ||
    process.env.LLM_URL ||
    '';
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  if (trimmed.includes('/audio/transcriptions')) return trimmed;
  if (trimmed.includes('/chat/completions')) return trimmed.replace('/chat/completions', '/audio/transcriptions');
  return `${trimmed.replace(/\/$/, '')}/audio/transcriptions`;
}

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private prisma = new PrismaClient();

  constructor(
    private readonly personaService: PersonaService,
    private readonly readingService: ReadingService,
    private readonly fortuneService: FortuneService,
    private readonly chartService: ChartService,
  ) {}

  private refineIntentByReadiness(intent: AgentIntent, dto: AgentChatDto): AgentIntent {
    if (intent === 'divination' && !this.isDivinationQuestionReady(dto.message)) {
      return 'chat';
    }
    if (intent === 'zi' && !this.extractZiFromMessage(dto.message)) {
      return 'chat';
    }
    return intent;
  }

  private isDivinationQuestionReady(message: string): boolean {
    const text = (message || '').trim();
    if (text.length < 8) return false;
    const hasQuestionSignals =
      /[？?]|要不要|该不该|怎么办|能不能|何时|什么时候|会不会|适不适合|是否/.test(text);
    return hasQuestionSignals;
  }

  private async buildIntentArtifacts(
    intent: AgentIntent,
    dto: AgentChatDto,
    mood: AgentChatDto['mood'],
    userChart: any,
    category?: 'career' | 'emotion' | 'growth',
  ): Promise<{ artifacts: Record<string, unknown>; actions: AgentAction[] }> {
    const actions: AgentAction[] = [];
    let artifacts: Record<string, unknown> = {};
    let divinationCategory = category === 'emotion' ? 'love' : category;
    divinationCategory = this.inferCategoryFromContext(dto) || divinationCategory;

    if (intent === 'divination') {
      try {
        const reading = await this.readingService.generate({
          question: dto.message,
          category: (divinationCategory as DivinationCategory) || this.inferCategory(dto.message),
          userId: dto.userId,
        });
        if (dto.userId) {
          try {
            await this.prisma.reading.create({
              data: {
                userId: dto.userId,
                question: dto.message,
                category: (divinationCategory as DivinationCategory) || this.inferCategory(dto.message),
                result: JSON.stringify(reading),
              },
            });
          } catch (error) {
            this.logger.warn(`写入占卜记录失败: ${(error as Error).message}`);
          }
        }
        artifacts = { reading };
        actions.push({ type: 'view_reading', label: '查看完整解读' });
      } catch {
        artifacts = { reading: null };
      }
      return { artifacts, actions };
    }

    if (intent === 'meditation') {
      artifacts = { meditation: this.buildMeditation({ ...dto, mood }) };
      actions.push({ type: 'start_meditation', label: '开始冥想' });
      return { artifacts, actions };
    }

    if (intent === 'fortune') {
      artifacts = { fortune: this.fortuneService.getDailyFortune(dto.userId) };
      actions.push({ type: 'view_fortune', label: '查看今日运势' });
      return { artifacts, actions };
    }

    if (intent === 'chart') {
      artifacts = { chart: userChart, hasChart: !!userChart };
      if (userChart) actions.push({ type: 'view_chart', label: '查看命盘详情' });
      return { artifacts, actions };
    }

    if (intent === 'zi') {
      const ziChar = this.extractZiFromMessage(dto.message);
      artifacts = { ziSuggestion: { zi: ziChar } };
      actions.push({ type: 'view_zi', label: '进入测字页面' });
      return { artifacts, actions };
    }

    return { artifacts, actions };
  }

  async *handleChatStream(dto: AgentChatDto): AsyncGenerator<Record<string, unknown>> {
    if (!dto.message || dto.message.trim().length === 0) {
      yield { type: 'error', message: '消息不能为空' };
      return;
    }
    if (dto.message.length > 500) {
      yield { type: 'error', message: '消息长度不能超过500字符' };
      return;
    }

    const persona = this.resolvePersona(dto.personaId);
    let userChart: any = null;
    if (dto.userId) {
      try {
        userChart = await this.chartService.findOne(dto.userId);
      } catch {
        // ignore
      }
    }

    const classified = await this.classifyWithDeepSeek(dto, persona, userChart);
    const intent = this.refineIntentByReadiness(classified.intent, dto);
    const intentResult = await this.buildIntentArtifacts(
      intent,
      dto,
      classified.mood,
      userChart,
      classified.category,
    );
    const actions = intentResult.actions;
    let artifacts = intentResult.artifacts;
    if (intent === 'chat' && classified.intent === 'divination') {
      actions.push({ type: 'view_reading', label: '补充问题后起卦' });
      artifacts = {
        ...artifacts,
        intentGuide: '起卦前请补一句具体问题，例如：我该不该在三个月内换工作？',
      };
    }
    if (intent === 'chat' && classified.intent === 'zi') {
      actions.push({ type: 'view_zi', label: '去测字并写下单字' });
      artifacts = {
        ...artifacts,
        intentGuide: '测字时请给出一个单字，并说明你最想问的事情。',
      };
    }

    let reply = '';
    if (intent === 'chat') {
      for await (const chunk of this.generateAIReplyStream(dto.message, persona, userChart, dto)) {
        reply += chunk;
        yield { type: 'chunk', content: chunk };
      }
    } else {
      reply = await this.composeReply(persona, intent, dto.message, artifacts, userChart, dto);
      yield { type: 'chunk', content: reply };
    }
    if (dto.userId) {
      try {
        await this.prisma.chatMessage.create({
          data: {
            userId: dto.userId,
            message: dto.message,
            reply,
            intent,
            personaId: dto.personaId,
            mood: dto.mood || undefined,
            artifacts: JSON.stringify(artifacts),
          },
        });
      } catch {
        // ignore
      }
    }

    yield {
      type: 'done',
      persona: persona.id,
      intent,
      reply,
      actions,
      artifacts,
      hasChart: !!userChart,
    };
  }

  async handleChat(dto: AgentChatDto) {
    // 验证输入
    if (!dto.message || dto.message.trim().length === 0) {
      throw new BadRequestException('消息不能为空');
    }

    // 限制消息长度
    if (dto.message.length > 500) {
      throw new BadRequestException('消息长度不能超过500字符');
    }

    const persona = this.resolvePersona(dto.personaId);
    
    // 获取用户命盘（如有）
    let userChart: any = null;
    if (dto.userId) {
      try {
        userChart = await this.chartService.findOne(dto.userId);
      } catch (error) {
        this.logger.warn(`获取用户命盘失败: ${(error as Error).message}`);
      }
    }
    
    const classified = await this.classifyWithDeepSeek(dto, persona, userChart);
    const intent = this.refineIntentByReadiness(classified.intent, dto);
    const intentResult = await this.buildIntentArtifacts(
      intent,
      dto,
      classified.mood,
      userChart,
      classified.category,
    );
    const actions = intentResult.actions;
    let artifacts = intentResult.artifacts;
    if (intent === 'chat' && classified.intent === 'divination') {
      actions.push({ type: 'view_reading', label: '补充问题后起卦' });
      artifacts = {
        ...artifacts,
        intentGuide: '起卦前请补一句具体问题，例如：我该不该在三个月内换工作？',
      };
    }
    if (intent === 'chat' && classified.intent === 'zi') {
      actions.push({ type: 'view_zi', label: '去测字并写下单字' });
      artifacts = {
        ...artifacts,
        intentGuide: '测字时请给出一个单字，并说明你最想问的事情。',
      };
    }

    const reply = await this.composeReply(persona, intent, dto.message, artifacts, userChart, dto);

    // 保存聊天记录到数据库
    if (dto.userId) {
      try {
        await this.prisma.chatMessage.create({
          data: {
            userId: dto.userId,
            message: dto.message,
            reply,
            intent,
            personaId: dto.personaId,
            mood: dto.mood || undefined,
            artifacts: JSON.stringify(artifacts),
          },
        });
      } catch (error) {
        this.logger.error('保存聊天记录失败', error.message);
      }
    }

    return {
      persona: persona.id,
      intent,
      reply,
      actions,
      artifacts,
      hasChart: !!userChart,
    };
  }

  /**
   * 从消息中提取要测的字
   */
  private extractZiFromMessage(message: string): string | null {
    // 匹配消息中的第一个汉字
    const match = message.match(/[\u4e00-\u9fa5]/);
    return match ? match[0] : null;
  }

  private async classifyWithDeepSeek(
    dto: AgentChatDto,
    persona: PersonaSchema,
    userChart: any,
  ): Promise<{ intent: AgentIntent; category?: 'career' | 'emotion' | 'growth'; mood?: AgentChatDto['mood'] }> {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    const model = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat';

    if (!apiKey) {
      this.logger.warn('DEEPSEEK_API_KEY 未配置，回退到本地规则意图识别');
      const fallbackIntent = this.fallbackDetectIntent(dto.message, userChart);
      return { intent: fallbackIntent };
    }

    try {
      // 构建上下文
      const contextInfo = userChart 
        ? `\n用户八字：${userChart.yearGanZhi}年 ${userChart.monthGanZhi}月 ${userChart.dayGanZhi}日 ${userChart.hourGanZhi}时`
        : '\n用户尚未建立命盘';

      const contextLines = (dto.context || []).slice(-6).join('\n');
      const response = await axios.post(
        process.env.DEEPSEEK_API_URL ?? 'https://api.deepseek.com/chat/completions',
        {
          model,
          temperature: 0,
          max_tokens: 512,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `你是一个山海灵境的 AI 助手，负责在"聊天/占卜/冥想/命盘/运势/测字"之间选择最合适的工具。请只返回 JSON，格式：{ "intent": "xxx", "category": "xxx" }。

可选意图：
- chat: 日常聊天、情绪倾诉、心理疏导、表达迷茫/困惑/纠结、追问、附和、简短回复（优先选 chat，先多聊）
- divination: 仅当用户明确说出「占卜」「问卦」「起卦」「算一卦」「帮我算一卦」「我想问卦」等词时
- meditation: 用户焦虑、失眠、想静心
- chart: 用户想查看命盘、八字、个人分析
- fortune: 用户想看今日运势、抽签
- zi: 用户写了一个字要测字、问这个字怎么样

【占卜触发极严格】以下情况一律选 chat，绝不选 divination：
- 追问、附和：然后呢、那怎么办、你觉得呢、嗯、好的、谢谢、继续
- 倾诉、表达感受：迷茫、纠结、不顺、不知道怎么办（未明确说想占卜）
- 延续对话、简短回复
宁可漏掉占卜（用户可再说一次），绝不要误判。有疑虑时一律选 chat。
若用户虽提到占卜但问题不具体（如“帮我算算”），先选 chat 追问具体问题，再进入 divination。

当 intent 为 divination 时，必须根据用户问题（含上下文）返回 category：
- love: 正缘、婚姻、伴侣、桃花、遇见、缘分、感情、恋爱
- career: 工作、事业、职业、升职
- wealth: 财运、财富、投资
- health: 健康、身体
- growth: 个人成长、迷茫、方向（仅当不涉及上述具体领域时）

重要：结合上下文判断。若用户问「正缘在哪里」「什么时候遇见」等，category 必须为 love，不是 growth。

${contextInfo}`,
            },
            contextLines
              ? {
                  role: 'system',
                  content: `最近对话（由近到远）：\n${contextLines}\n\n请结合上下文判断。若助手最近一条回复已包含「所得卦象」「卦象」等，说明刚占卜过，用户下一条（追问、那怎么办等）一律选 chat，不要再次占卜。若用户在问婚姻/正缘，category 必须为 love。`,
                }
              : null,
            {
              role: 'user',
              content: JSON.stringify({
                message: dto.message,
                mood: dto.mood,
                persona: { id: persona.id, name: persona.name },
                hasChart: !!userChart,
                context: contextLines || undefined,
              }),
            },
          ].filter(Boolean),
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000, // 10秒超时
        },
      );

      const raw = response.data?.choices?.[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(raw);

      const validIntents: AgentIntent[] = ['chat', 'divination', 'meditation', 'chart', 'fortune', 'zi'];
      let intent: AgentIntent = validIntents.includes(parsed.intent) ? parsed.intent : 'chat';

      // 若上下文显示刚占卜过，用户下一条一律 chat，避免连续弹卦象
      const contextStr = (dto.context || []).join('');
      const followUpPatterns = /然后呢|那怎么办|你觉得呢|嗯|好的|谢谢|继续|还有呢|然后呢/;
      if (
        intent === 'divination' &&
        (contextStr.includes('所得卦象') || contextStr.includes('卦象')) &&
        (dto.message.length <= 15 || followUpPatterns.test(dto.message.trim()))
      ) {
        intent = 'chat';
      }

      return {
        intent,
        category: parsed.category,
        mood: parsed.mood,
      };
    } catch (error) {
      this.logger.error(`DeepSeek 意图识别失败: ${error.message}，使用本地规则回退`);
      const intent = this.fallbackDetectIntent(dto.message, userChart);
      return { intent };
    }
  }

  private fallbackDetectIntent(message: string, userChart: any): AgentIntent {
    const text = message.toLowerCase();
    
    // 命盘相关关键词
    const chartKeywords = ['命盘', '八字', '我的命', '排盘', '紫微', '五行', '日主', '强弱'];
    // 运势相关关键词
    const fortuneKeywords = ['今日运势', '今天运气', '抽签', '日签', '运气', '求签'];
    // 占卜相关关键词（需明确占卜意图，迷茫/困惑等不算）
    const divinationKeywords = ['占卜', '起卦', '问卦', '算一卦', '帮我算', '解读卦', '问卜'];
    // 冥想相关关键词
    const meditationKeywords = ['焦虑', '冥想', '睡不着', '平静', '紧张', '失眠', '静心'];
    // 测字相关关键词
    const ziKeywords = ['测字', '看字', '字怎么样', '字的意思', '帮我看看这个字', '这个字怎么样'];
    
    // 检查是否是纯汉字且很短（可能是测字，但需要明确意图）
    // 只有明确包含测字关键词才触发
    if (ziKeywords.some(word => text.includes(word))) {
      return 'zi';
    }
    
    if (chartKeywords.some(word => text.includes(word))) {
      return 'chart';
    }
    if (fortuneKeywords.some(word => text.includes(word))) {
      return 'fortune';
    }
    if (divinationKeywords.some(word => text.includes(word))) {
      return 'divination';
    }
    if (meditationKeywords.some(word => text.includes(word))) {
      return 'meditation';
    }
    
    // 默认都是聊天
    return 'chat';
  }

  private inferCategory(message: string): DivinationCategory {
    if (message.includes('工作') || message.includes('职业') || message.includes('事业')) {
      return 'career';
    }
    if (message.includes('感情') || message.includes('爱情') || message.includes('桃花')) {
      return 'love';
    }
    if (message.includes('财富') || message.includes('财运') || message.includes('钱')) {
      return 'wealth';
    }
    return 'growth';
  }

  /** 结合上下文推断占卜方向，优先识别 love（正缘/婚姻等） */
  private inferCategoryFromContext(dto: AgentChatDto): DivinationCategory | undefined {
    const fullText = [
      dto.message,
      ...(dto.context || []),
    ].join(' ');
    const loveKeywords = ['正缘', '婚姻', '伴侣', '桃花', '遇见', '缘分', '恋爱', '对象', '脱单'];
    if (loveKeywords.some((k) => fullText.includes(k))) return 'love';
    if (fullText.includes('工作') || fullText.includes('事业') || fullText.includes('职业')) return 'career';
    if (fullText.includes('财运') || fullText.includes('财富') || fullText.includes('钱')) return 'wealth';
    if (fullText.includes('健康') || fullText.includes('身体')) return 'health';
    return undefined;
  }

  private resolvePersona(personaId?: string) {
    if (!personaId) {
      return this.personaService.findAll()[0];
    }
    return this.personaService.findOne(personaId as any);
  }

  private buildMeditation(dto: AgentChatDto) {
    const scripts = {
      calm: [
        '找一个舒适的姿势，轻闭双眼，缓慢深呼吸三次。',
        '吸气时默念"山海入怀"，呼气时默念"烦忧皆散"。',
        '想象自己置身雾霭青山，远处传来古琴声，心逐渐沉静。',
      ],
      anxious: [
        '深深的吸一口气，感受空气从鼻腔进入，流经全身。',
        '呼气时想象把所有焦虑都呼出去。',
        '重复三次，感受身体逐渐放松。',
      ],
      sad: [
        '闭上眼睛，感受自己的情绪，允许悲伤存在。',
        '想象有一道温暖的光包裹着自己。',
        '告诉自己，所有的情绪都是暂时的。',
      ],
      confused: [
        '放空大脑，不要刻意思考任何事情。',
        '呼吸放慢，让思绪自然流动。',
        '相信自己内心的智慧会指引方向。',
      ],
    };

    const mood = dto.mood || 'calm';
    const script = scripts[mood] || scripts.calm;

    return {
      durationMinutes: 5,
      mood: dto.mood ?? 'calm',
      script,
    };
  }

  /**
   * 流式生成 AI 回复（仅 chat 意图使用）
   */
  private async *generateAIReplyStream(
    message: string,
    persona: PersonaSchema,
    userChart: any,
    dto: AgentChatDto,
  ): AsyncGenerator<string> {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    const model = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat';
    if (!apiKey) {
      yield this.getDefaultChatReply(persona, userChart);
      return;
    }

    const recentMemory = dto.userId ? await this.fetchRecentChatMemory(dto.userId) : [];
    const longTermMemory = dto.userId ? await this.buildLongTermMemory(dto.userId) : '';
    const contextLines = (dto.context || []).slice(-8);
    const conversationContext = [...recentMemory, ...contextLines].slice(-12).join('\n');

    let contextInfo = '';
    if (userChart) {
      const wxNames: Record<string, string> = {
        wood: '木', fire: '火', earth: '土', metal: '金', water: '水',
      };
      const dominantWx = Object.entries(userChart.wuxingStrength as Record<string, number>)
        .sort((a, b) => b[1] - a[1])[0];
      contextInfo = `
用户命盘信息：
- 八字：${userChart.yearGanZhi}年 ${userChart.monthGanZhi}月 ${userChart.dayGanZhi}日 ${userChart.hourGanZhi}时
- 日主：${userChart.dayGanZhi}
- 最强的五行：${wxNames[dominantWx[0]]}性 (${dominantWx[1]}%)
- 性格特点：${userChart.personalityTraits.slice(0, 3).join('、')}
`;
    }

    const systemPrompt = `${persona.description}

你是${persona.name}，${persona.title}。
${contextInfo}
${longTermMemory ? `\n用户长期记忆：\n${longTermMemory}\n` : ''}

你的回复风格：
- toneTags: ${persona.toneTags.join('、')}
- 以现代白话为主，自然亲切，偶尔用一两句雅致词汇点缀即可
- 不要刻意堆砌古文、诗词典故，避免「庚金之性」「子水桃花」等过于晦涩的表达
- 理解用户的情感需求，给予温暖、有智慧的回应
- 回复结构优先采用「先共情，再解读，后建议」
- 使用“大师四步”：定心（共情）→断势（判断）→开解（给路）→落地（下一步）
- 每次回复控制在100-200字之间，保持简洁有力
- 绝对不要输出"角色名："前缀，不要输出舞台动作括号
- 先回应用户当前语句的真实语义；如果信息不足，可温和追问
- 除非在本次对话上下文里有明确且可核验的记录，否则不要说“上次你……”或引用具体历史细节（例如“上次测了某个字”）
- 若用户在聊“事业/工作”，优先用四段结构：
- 若用户在聊“事业/感情/财务/健康/成长”追问，优先用四段结构：
  1) 盘面证据（引用1-2个命盘锚点，不要空泛）
  2) 7天可执行动作（至少2条，具体可做）
  3) 二选一追问（降低用户思考负担）
  4) 轻转化钩子（自然、不过度推销）

注意：用户可能只是在倾诉，不要急着给出建议，先表达理解和共情。`;

    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...(conversationContext
        ? [{ role: 'system' as const, content: `近期对话：\n${conversationContext}\n\n请自然承接上下文。` }]
        : []),
      { role: 'user', content: message },
    ];

    try {
      const apiUrl = process.env.DEEPSEEK_API_URL ?? 'https://api.deepseek.com/chat/completions';
      const startedAt = Date.now();
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.8,
          max_tokens: 300,
          stream: true,
          messages,
        }),
      });

      if (!res.ok || !res.body) {
        this.logger.warn(`LLM(stream) 响应异常 status=${res.status} duration=${Date.now() - startedAt}ms`);
        yield this.getDefaultChatReply(persona, userChart);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              const content = parsed?.choices?.[0]?.delta?.content;
              if (content) {
                fullContent += content;
                yield content;
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      }

      if (!fullContent.trim()) {
        yield this.getDefaultChatReply(persona, userChart);
      }
      this.logger.log(`LLM(stream) completed duration=${Date.now() - startedAt}ms size=${fullContent.length}`);
    } catch (error) {
      this.logger.error(`DeepSeek 流式生成失败: ${(error as Error).message}`);
      yield this.getDefaultChatReply(persona, userChart);
    }
  }

  /**
   * 使用 DeepSeek AI 生成真正的个性化回复
   */
  private async generateAIReply(
    message: string,
    persona: PersonaSchema,
    userChart: any,
    dto: AgentChatDto,
  ): Promise<string> {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    const model = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat';

    // 如果没有配置APIKey，使用默认回复
    if (!apiKey) {
      return this.getDefaultChatReply(persona, userChart);
    }

    const recentMemory = dto.userId ? await this.fetchRecentChatMemory(dto.userId) : [];
    const longTermMemory = dto.userId ? await this.buildLongTermMemory(dto.userId) : '';
    const contextLines = (dto.context || []).slice(-8);
    const conversationContext = [...recentMemory, ...contextLines].slice(-12).join('\n');

    try {
      const llmStartAt = Date.now();
      // 构建用户上下文
      let contextInfo = '';
      if (userChart) {
        const wxNames: Record<string, string> = {
          wood: '木', fire: '火', earth: '土', metal: '金', water: '水'
        };
        const dominantWx = Object.entries(userChart.wuxingStrength as Record<string, number>)
          .sort((a, b) => b[1] - a[1])[0];
        
        contextInfo = `
用户命盘信息：
- 八字：${userChart.yearGanZhi}年 ${userChart.monthGanZhi}月 ${userChart.dayGanZhi}日 ${userChart.hourGanZhi}时
- 日主：${userChart.dayGanZhi}
- 最强的五行：${wxNames[dominantWx[0]]}性 (${dominantWx[1]}%)
- 性格特点：${userChart.personalityTraits.slice(0, 3).join('、')}
`;
      }

      // 构建系统提示词
      const systemPrompt = `${persona.description}

你是${persona.name}，${persona.title}。
${contextInfo}
${longTermMemory ? `\n用户长期记忆：\n${longTermMemory}\n` : ''}

你的回复风格：
- toneTags: ${persona.toneTags.join('、')}
- 以现代白话为主，自然亲切，偶尔用一两句雅致词汇点缀即可
- 不要刻意堆砌古文、诗词典故，避免「庚金之性」「子水桃花」等过于晦涩的表达
- 理解用户的情感需求，给予温暖、有智慧的回应
- 回复结构优先采用「先共情，再解读，后建议」
- 使用“大师四步”：定心（共情）→断势（判断）→开解（给路）→落地（下一步）
- 每次回复控制在100-200字之间，保持简洁有力
- 如果用户提到命理相关内容，可以适当引用用户的八字信息给出个性化建议
- 绝对不要输出"角色名："前缀，不要输出舞台动作括号（如“（轻抚长须）”）
- 先回应用户当前语句的真实语义；如果信息不足，可温和追问，不要自说自话
- 除非在本次对话上下文里有明确且可核验的记录，否则不要说“上次你……”或引用具体历史细节（例如“上次测了某个字”）
- 若用户在聊“事业/工作”，优先用四段结构：
- 若用户在聊“事业/感情/财务/健康/成长”追问，优先用四段结构：
  1) 盘面证据（引用1-2个命盘锚点，不要空泛）
  2) 7天可执行动作（至少2条，具体可做）
  3) 二选一追问（降低用户思考负担）
  4) 轻转化钩子（自然、不过度推销）

注意：
- 用户可能只是在倾诉，不要急着给出建议，先表达理解和共情
- 如果用户问的是专业命理问题，引导他们使用相应的功能（占卜/测字/命盘）
- 保持神秘感和东方美学气质`;

      const response = await axios.post(
        process.env.DEEPSEEK_API_URL ?? 'https://api.deepseek.com/chat/completions',
        {
          model,
          temperature: 0.8, // 稍高一点温度，让回复更生动
          max_tokens: 300,
          messages: [
            { role: 'system', content: systemPrompt },
            conversationContext
              ? {
                  role: 'system',
                  content: `以下是近期对话上下文（由近到远）：\n${conversationContext}\n\n请在回复中自然承接上下文，不要重复已确认的信息。`,
                }
              : null,
            { role: 'user', content: message },
          ].filter(Boolean),
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        },
      );
      this.logger.log(
        `LLM(chat) completed duration=${Date.now() - llmStartAt}ms contentSize=${
          response.data?.choices?.[0]?.message?.content?.length || 0
        }`,
      );

      const reply = response.data?.choices?.[0]?.message?.content?.trim();
      if (reply) {
        return reply.replace(/^[^：:\n]{1,12}[：:]\s*/u, '').trim();
      }
      
      return this.getDefaultChatReply(persona, userChart);
    } catch (error) {
      this.logger.error(`DeepSeek 生成回复失败: ${(error as Error).message}`);
      return this.getDefaultChatReply(persona, userChart);
    }
  }

  /**
   * 默认聊天回复（当AI不可用时）
   */
  private getDefaultChatReply(persona: PersonaSchema, userChart: any): string {
    const defaultReplies = [
      `我听到了你的心声。山海之间，万物有灵，愿你在这纷扰里也能有一处安稳。`,
      `你这句话很真。命运有起伏，但你并不孤单，我们可以一点点理清。`,
      `你的困惑我记下了。若你愿意，我们可以先从最让你在意的一点开始聊。`,
      `人生如逆旅，你愿意说出来，已经是很重要的一步。我们慢慢来。`,
    ];

    // 如果用户有命盘，添加个性化引用
    if (userChart) {
      const wxNames: Record<string, string> = {
        wood: '木', fire: '火', earth: '土', metal: '金', water: '水'
      };
      const dominantWx = Object.entries(userChart.wuxingStrength as Record<string, number>)
        .sort((a, b) => b[1] - a[1])[0];
      
      const personalizedReplies = [
        `从你的八字看，你的${wxNames[dominantWx[0]]}性较强。最近可以做些对应属性的事情，先把状态稳住。`,
        `我注意到你的日主是${userChart.dayGanZhi}。你有自己独特的节奏，有心事可以慢慢讲。`,
      ];
      return personalizedReplies[Math.floor(Math.random() * personalizedReplies.length)];
    }

    return defaultReplies[Math.floor(Math.random() * defaultReplies.length)];
  }

  private async fetchRecentChatMemory(userId: string): Promise<string[]> {
    try {
      const rows = await this.prisma.chatMessage.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { message: true, reply: true },
      });
      return rows.flatMap((row) => {
        const lines: string[] = [];
        if (row.message) lines.push(`用户：${row.message}`);
        if (row.reply) lines.push(`助手：${row.reply}`);
        return lines;
      });
    } catch (error) {
      this.logger.warn(`读取近期聊天记忆失败: ${(error as Error).message}`);
      return [];
    }
  }

  private async buildLongTermMemory(userId: string): Promise<string> {
    try {
      const [user, recentChats, recentZi, recentReadings] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: userId },
          select: { focusGod: true, birthLocation: true },
        }),
        this.prisma.chatMessage.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 40,
          select: { intent: true, message: true },
        }),
        this.prisma.ziAnalysis.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { zi: true },
        }),
        this.prisma.reading.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { category: true },
        }),
      ]);

      const concernKeywords: Array<{ key: string; tags: string[] }> = [
        { key: '事业', tags: ['工作', '职业', '事业', '升职', '离职', '跳槽'] },
        { key: '感情', tags: ['感情', '恋爱', '婚姻', '对象', '关系', '分手'] },
        { key: '财务', tags: ['财运', '收入', '赚钱', '投资', '负债', '现金'] },
        { key: '健康', tags: ['健康', '睡眠', '焦虑', '压力', '情绪'] },
      ];

      const joined = recentChats.map((x) => x.message || '').join(' ');
      const concerns = concernKeywords
        .map((cfg) => ({
          key: cfg.key,
          score: cfg.tags.reduce((acc, t) => acc + (joined.includes(t) ? 1 : 0), 0),
        }))
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 2)
        .map((x) => x.key);

      const ziCount = recentZi
        .map((z) => z.zi)
        .filter(Boolean).length;
      const readingCats = recentReadings
        .map((r) => r.category)
        .filter(Boolean)
        .slice(0, 3)
        .join('、');
      const dominantIntent = this.pickDominantIntent(
        recentChats.map((x) => x.intent).filter(Boolean) as string[],
      );

      const memoryLines = [
        concerns.length ? `长期关注主题：${concerns.join('、')}` : '',
        ziCount > 0 ? '近期有测字记录' : '',
        readingCats ? `近期问卦方向：${readingCats}` : '',
        dominantIntent ? `对话偏好：${dominantIntent}` : '',
        user?.focusGod ? `命理偏好：${user.focusGod}` : '',
        user?.birthLocation ? `成长地域：${user.birthLocation}` : '',
      ].filter(Boolean);

      return memoryLines.join('\n');
    } catch (error) {
      this.logger.warn(`构建长期记忆失败: ${(error as Error).message}`);
      return '';
    }
  }

  private pickDominantIntent(intents: string[]): string {
    if (!intents.length) return '';
    const counter = intents.reduce<Record<string, number>>((acc, it) => {
      acc[it] = (acc[it] || 0) + 1;
      return acc;
    }, {});
    const top = Object.entries(counter).sort((a, b) => b[1] - a[1])[0];
    const map: Record<string, string> = {
      chat: '更偏情绪陪伴交流',
      divination: '更偏结构化占卜解读',
      fortune: '更偏轻量运势反馈',
      zi: '更偏测字式自我探索',
    };
    return map[top[0]] || top[0];
  }

  private async getUserMembership(userId?: string): Promise<'free' | 'premium' | 'vip'> {
    if (!userId) return 'free';
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { membership: true, membershipExpiryAt: true },
      });
      const membership = user?.membership;
      if (membership === 'premium' || membership === 'vip') {
        if (user?.membershipExpiryAt && new Date() > user.membershipExpiryAt) return 'free';
        return membership;
      }
      return 'free';
    } catch {
      return 'free';
    }
  }

  private buildConversionHint(intent: AgentIntent, membership: 'free' | 'premium' | 'vip'): string {
    if (membership !== 'free') return '';
    if (intent === 'divination') {
      return '如果你想把这件事看得更透，我可以继续给你做「时间窗口 + 风险位 + 三步行动计划」的深度拆盘。';
    }
    if (intent === 'fortune') {
      return '要是你愿意，我可以基于你这周的重点议题，给你做一版更细的日程化建议。';
    }
    if (intent === 'zi') {
      return '你可以去测字页做完整仪式化解读（含方向深挖），结论会更具体。';
    }
    if (intent === 'chart') {
      return '后续我还能把你的命盘和你当下问题做联动解读，让建议更贴身。';
    }
    return '';
  }

  private isCareerQuery(message: string, context?: string[]): boolean {
    const text = `${message || ''} ${(context || []).join(' ')}`;
    return /事业|工作|职业|升职|跳槽|转型|副业|面试|offer|岗位|发展|赛道/.test(text);
  }

  private isLoveQuery(message: string, context?: string[]): boolean {
    const text = `${message || ''} ${(context || []).join(' ')}`;
    return /感情|恋爱|婚姻|对象|脱单|复合|正缘|桃花|关系|伴侣/.test(text);
  }

  private isWealthQuery(message: string, context?: string[]): boolean {
    const text = `${message || ''} ${(context || []).join(' ')}`;
    return /财运|财富|赚钱|收入|投资|副业变现|现金流|存款|负债|开源/.test(text);
  }

  private isHealthQuery(message: string, context?: string[]): boolean {
    const text = `${message || ''} ${(context || []).join(' ')}`;
    return /健康|睡眠|焦虑|压力|疲惫|情绪|失眠|身体|状态|内耗/.test(text);
  }

  private isShortFollowUp(message: string): boolean {
    const text = (message || '').trim();
    if (text.length <= 8) return true;
    return /^(事业|事业吧|工作|工作吧|继续|然后呢|那怎么办|你觉得呢|嗯|好的|是的)$/.test(text);
  }

  private buildCareerChartEvidence(userChart: any): string {
    const wx = (userChart?.wuxingStrength || {}) as Record<string, number>;
    const pairs = Object.entries(wx).filter(([, v]) => typeof v === 'number');
    if (!pairs.length) return `你盘里「${userChart?.dayGanZhi || '日主'}」的主轴很明显。`;
    const sorted = pairs.sort((a, b) => Number(b[1]) - Number(a[1]));
    const map: Record<string, string> = { wood: '木', fire: '火', earth: '土', metal: '金', water: '水' };
    const top = sorted[0];
    const low = sorted[sorted.length - 1];
    return `盘面锚点：日主「${userChart?.dayGanZhi || '未定'}」，${map[top[0]] || top[0]}偏强(${Math.round(Number(top[1]))}%)、${map[low[0]] || low[0]}偏弱(${Math.round(Number(low[1]))}%)。`;
  }

  private buildCareerFollowUpReply(
    userChart: any,
    membership: 'free' | 'premium' | 'vip',
    conversionHint: string,
  ): string {
    const evidence = this.buildCareerChartEvidence(userChart);
    const profileHint = userChart?.fortuneSummary?.career
      ? `你当前事业节奏更像：${userChart.fortuneSummary.career}`
      : '你现在更适合“先稳主线，再开副线”的推进节奏。';
    const action1 = '本周先锁定1个主目标（升职/跳槽/副业三选一），其余不并行。';
    const action2 = '连续7天每天30分钟做“可见成果动作”（投递、作品、复盘、拓人脉任选其一）。';
    const close =
      membership === 'free'
        ? `如果你愿意，我可以再把你未来两季度拆成“机会月/避险月 + 行动清单”。${conversionHint ? `\n${conversionHint}` : ''}`
        : '如果你愿意，我下一步可以按你当前行业，给你拆一版未来两季度的机会窗口与行动表。';
    return `你问“事业”，这个方向很对。\n\n${evidence}\n${profileHint}\n\n先给你一个7天可执行版本：\n1) ${action1}\n2) ${action2}\n\n你更想先看哪一块：A. 近3个月适不适合跳槽  B. 现在岗位如何提速拿结果？\n\n${close}`;
  }

  private buildDomainFollowUpReply(
    domain: 'career' | 'love' | 'wealth' | 'health' | 'growth',
    userChart: any,
    membership: 'free' | 'premium' | 'vip',
    conversionHint: string,
  ): string {
    const evidence = this.buildCareerChartEvidence(userChart);
    const baseClose =
      membership === 'free'
        ? conversionHint || '如果你愿意，我可以继续给你做更细的时间窗口与行动清单。'
        : '如果你愿意，我可以继续按你的节奏拆成更细的行动表。';

    if (domain === 'love') {
      return `你这个追问很关键，感情这件事确实要看“节奏”和“边界”。\n\n${evidence}\n从盘面看，你更需要“先稳关系里的安全感，再推进承诺”。\n\n先给你一个7天动作：\n1) 只做1次高质量沟通：讲清需求，不翻旧账。\n2) 每天记录1条“关系里让我安心/不安的触发点”。\n\n你想先看哪一块：A. 近期是否适合推进关系  B. 如何判断这段关系值不值得继续？\n\n${baseClose}`;
    }

    if (domain === 'wealth') {
      return `你问到财务，很务实，这一步很对。\n\n${evidence}\n当前更适合“先稳现金流，再追增量收益”。\n\n先给你一个7天动作：\n1) 列出近30天支出，砍掉1项低回报开销。\n2) 每天固定30分钟做1件增收动作（复盘报价/投递合作/发布作品）。\n\n你想先看哪一块：A. 未来3个月财务风险点  B. 先做副业还是先冲主业涨薪？\n\n${baseClose}`;
    }

    if (domain === 'health') {
      return `你这个追问很及时，状态稳住了，很多事才会顺。\n\n${evidence}\n你现在的关键不是“硬扛”，而是先把睡眠和情绪阈值拉回安全区。\n\n先给你一个7天动作：\n1) 连续7天固定入睡时间，睡前30分钟停用高刺激信息。\n2) 每天安排一次20分钟低强度运动或静息呼吸。\n\n你想先看哪一块：A. 先改善睡眠  B. 先降低白天焦虑波动？\n\n${baseClose}`;
    }

    if (domain === 'growth') {
      return `你这个追问很有价值，成长期最怕“方向很多、动作太散”。\n\n${evidence}\n你现在更适合“先定一个主轴，再做小步快跑验证”。\n\n先给你一个7天动作：\n1) 选1个核心方向，写下“本周唯一里程碑”。\n2) 每晚复盘10分钟，只看“今天是否更接近目标”。\n\n你想先看哪一块：A. 如何选唯一主轴  B. 如何判断这个方向值得继续投入？\n\n${baseClose}`;
    }

    return this.buildCareerFollowUpReply(userChart, membership, conversionHint);
  }

  /**
   * 合成回复
   * 当是聊天意图时，使用AI生成个性化回复
   */
  private async composeReply(
    persona: PersonaSchema,
    intent: AgentIntent,
    message: string,
    artifacts: Record<string, unknown>,
    userChart: any,
    dto: AgentChatDto,
  ): Promise<string> {
    const membership = await this.getUserMembership(dto.userId);
    const conversionHint = this.buildConversionHint(intent, membership);

    // 测字回复：只引导去测字页，不在对话内直接出结果
    if (intent === 'zi') {
      const suggestedZi = (artifacts as any)?.ziSuggestion?.zi;
      const ziHint = suggestedZi ? `（可先用「${suggestedZi}」起测）` : '';
      return `你这个问题很适合用“字”来入局。${ziHint}\n\n建议你先静心10秒，心里只想着这件事，再写下一个字，这样解读会更聚焦。\n\n点击下方「进入测字页面」开始。${conversionHint ? `\n\n${conversionHint}` : ''}`;
    }

    // 占卜回复
    if (intent === 'divination' && artifacts.reading) {
      const reading = artifacts.reading as any;
      if (!reading) {
        return `抱歉，占卜服务暂时不可用，请稍后再试。`;
      }
      return `先抱抱你，带着这个问题来问卦，本身就很有勇气。\n\n【结论】${reading.interpretation.overall}\n【依据】卦象「${reading.hexagram.originalName}」\n【行动建议】${reading.recommendations[0]}\n\n若你愿意，我可以继续和你把下一步拆成更小、更可执行的动作。${conversionHint ? `\n\n${conversionHint}` : ''}`;
    }

    // 冥想回复
    if (intent === 'meditation') {
      return `我感受到你内心的不静。\n\n让我们一起做几次深呼吸，放下那些困扰你的事情。\n\n我为你准备了一段冥想引导，点击下方「开始冥想」即可。`;
    }

    // 运势回复
    if (intent === 'fortune' && artifacts.fortune) {
      const fortune = artifacts.fortune as any;
      return `今日与你有缘，也愿你心安。\n\n【今日签诗】${fortune.poem.title}\n【总体提示】${fortune.day}\n【行动建议】${fortune.advice[0]}\n\n幸运数字：${fortune.lucky.number}，幸运颜色：${fortune.lucky.color}${conversionHint ? `\n\n${conversionHint}` : ''}`;
    }

    // 命盘回复
    if (intent === 'chart') {
      if (userChart) {
        return `你的命盘已在此。\n\n🔮 八字：${userChart.dayGanZhi}（日主）\n🌟 五行：木${userChart.wuxingStrength.wood}% 火${userChart.wuxingStrength.fire}% 土${userChart.wuxingStrength.earth}% 金${userChart.wuxingStrength.metal}% 水${userChart.wuxingStrength.water}%\n\n📝 性格特点：${userChart.personalityTraits.slice(0, 2).join('、')}\n\n💼 事业：${userChart.fortuneSummary.career}\n💕 感情：${userChart.fortuneSummary.love}${conversionHint ? `\n\n${conversionHint}` : ''}`;
      } else {
        return `你还没有建立命盘呢。\n\n若想了解自己的八字命盘，可以先去「我的」页面输入出生信息，我会为你生成专属命盘分析。`;
      }
    }

    // 日常聊天 - 使用AI生成真正的个性化回复
    if (intent === 'chat') {
      if (userChart && this.isShortFollowUp(message)) {
        const contextCategory = this.inferCategoryFromContext(dto);
        let followUpDomain: 'career' | 'love' | 'wealth' | 'health' | 'growth' | null = null;
        if (contextCategory === 'career' || this.isCareerQuery(message, dto.context)) followUpDomain = 'career';
        else if (contextCategory === 'love' || this.isLoveQuery(message, dto.context)) followUpDomain = 'love';
        else if (contextCategory === 'wealth' || this.isWealthQuery(message, dto.context)) followUpDomain = 'wealth';
        else if (contextCategory === 'health' || this.isHealthQuery(message, dto.context)) followUpDomain = 'health';
        else if (dto.context?.length) followUpDomain = 'growth';

        if (followUpDomain) {
          return this.buildDomainFollowUpReply(followUpDomain, userChart, membership, conversionHint);
        }
      }
      return await this.generateAIReply(message, persona, userChart, dto);
    }

    // 默认回复
    return `我听到了你的心绪。若想更进一步，可告诉我需要抽签、静坐还是查看命盘，我都在。`;
  }

  async transcribeAudio(buffer: Buffer, mimeType = 'audio/webm', filename = 'recording.webm'): Promise<string> {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('音频内容为空');
    }

    const preferTencent = this.shouldUseTencentStt();
    if (preferTencent) {
      try {
        return await this.transcribeWithTencent(buffer, mimeType, filename);
      } catch (error) {
        const errMsg = String((error as Error)?.message || '');
        const isUnsupportedFormat = /暂不支持该录音格式|Unsupported audio data format/i.test(errMsg);
        const allowFallback =
          isUnsupportedFormat
            ? this.canUseOpenAiFallback()
            : (process.env.STT_FALLBACK_OPENAI || 'true') !== 'false';
        if (!allowFallback) {
          if (isUnsupportedFormat) {
            throw new BadRequestException(
              `当前浏览器上传的是 ${mimeType}，腾讯云一句话识别不支持该容器格式；请开启 STT_FALLBACK_OPENAI 或改用支持 ogg-opus/m4a 的录音格式。`,
            );
          }
          throw error;
        }
        this.logger.warn(`腾讯云转写失败，回退兼容STT: ${(error as Error).message}`);
      }
    }

    return this.transcribeWithOpenAiCompatible(buffer, mimeType, filename);
  }

  private shouldUseTencentStt(): boolean {
    const provider = (process.env.STT_PROVIDER || process.env.LLM_STT_PROVIDER || '').trim().toLowerCase();
    if (provider === 'tencent' || provider === 'tencentcloud') return true;
    return !!(process.env.TENCENTCLOUD_SECRET_ID?.trim() && process.env.TENCENTCLOUD_SECRET_KEY?.trim());
  }

  private canUseOpenAiFallback(): boolean {
    const apiKey = process.env.LLM_API_KEY?.trim();
    const endpoint = resolveSttTranscriptionsUrl();
    return !!(apiKey && endpoint);
  }

  private mapTencentVoiceFormat(mimeType: string, filename: string): string | null {
    const mime = String(mimeType || '').toLowerCase();
    const name = String(filename || '').toLowerCase();
    if (mime.includes('wav') || name.endsWith('.wav')) return 'wav';
    if (mime.includes('mpeg') || mime.includes('mp3') || name.endsWith('.mp3')) return 'mp3';
    if (mime.includes('ogg') || mime.includes('opus') || name.endsWith('.ogg') || name.endsWith('.opus')) return 'ogg-opus';
    if (mime.includes('m4a') || name.endsWith('.m4a')) return 'm4a';
    if (mime.includes('aac') || name.endsWith('.aac')) return 'aac';
    if (name.endsWith('.pcm')) return 'pcm';
    if (name.endsWith('.speex')) return 'speex';
    if (name.endsWith('.silk')) return 'silk';
    if (name.endsWith('.amr')) return 'amr';
    // MediaRecorder 默认 webm，腾讯一句话接口不直接支持；走兜底兼容STT
    if (mime.includes('webm') || name.endsWith('.webm')) return null;
    return null;
  }

  private async transcribeWithTencent(buffer: Buffer, mimeType: string, filename: string): Promise<string> {
    const secretId = process.env.TENCENTCLOUD_SECRET_ID?.trim();
    const secretKey = process.env.TENCENTCLOUD_SECRET_KEY?.trim();
    const region = process.env.TENCENTCLOUD_REGION?.trim() || 'ap-shanghai';
    const engine = process.env.TENCENT_ASR_ENGINE || '16k_zh';
    if (!secretId || !secretKey) {
      throw new BadRequestException('腾讯云转写未配置密钥（TENCENTCLOUD_SECRET_ID/TENCENTCLOUD_SECRET_KEY）');
    }
    const voiceFormat = this.mapTencentVoiceFormat(mimeType, filename);
    if (!voiceFormat) {
      throw new BadRequestException(`腾讯云暂不支持该录音格式：${mimeType || filename || 'unknown'}`);
    }
    const AsrClient = (tencentcloud as any).asr.v20190614.Client;
    const client = new AsrClient({
      credential: { secretId, secretKey },
      region,
      profile: {
        httpProfile: { endpoint: 'asr.tencentcloudapi.com', reqTimeout: 45 },
      },
    });

    const req = {
      EngSerViceType: engine,
      SourceType: 1,
      VoiceFormat: voiceFormat,
      Data: buffer.toString('base64'),
      DataLen: buffer.length,
      UsrAudioKey: `voice_${Date.now()}`,
      ProjectId: 0,
      SubServiceType: 2,
      FilterPunc: 0,
      ConvertNumMode: 1,
      WordInfo: 0,
    } as Record<string, unknown>;

    try {
      const res = await client.SentenceRecognition(req);
      const text = String(res?.Result || '').trim();
      if (!text) {
        throw new BadRequestException('腾讯云未返回可用文本');
      }
      return text;
    } catch (error) {
      const msg =
        (error as any)?.response?.data?.Response?.Error?.Message ||
        (error as any)?.message ||
        '腾讯云语音转写失败';
      throw new BadRequestException(`腾讯云语音转写失败: ${msg}`);
    }
  }

  private async transcribeWithOpenAiCompatible(buffer: Buffer, mimeType = 'audio/webm', filename = 'recording.webm'): Promise<string> {
    const apiKey = process.env.LLM_API_KEY?.trim();
    const endpoint = resolveSttTranscriptionsUrl();
    const model = process.env.LLM_STT_MODEL?.trim() || 'whisper-1';
    if (!apiKey || !endpoint) {
      throw new BadRequestException('语音转写服务未配置，请设置 LLM_API_KEY 与 LLM_STT_API_URL');
    }

    const form = new FormData();
    form.append('model', model);
    form.append('language', 'zh');
    form.append('response_format', 'json');
    form.append('file', buffer, {
      filename,
      contentType: mimeType || 'audio/webm',
    });

    try {
      const res = await axios.post(endpoint, form, {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 45000,
        maxBodyLength: Infinity,
      });
      const text = String(res.data?.text || res.data?.transcript || '').trim();
      if (!text) {
        throw new BadRequestException('未识别到语音文本');
      }
      return text;
    } catch (error) {
      const msg =
        (error as any)?.response?.data?.error?.message ||
        (error as any)?.response?.data?.message ||
        (error as Error)?.message ||
        '语音转写失败';
      this.logger.warn(`语音转写失败: ${msg}`);
      throw new BadRequestException(`语音转写失败: ${msg}`);
    }
  }
}
