import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { PersonaService, PersonaSchema } from '../persona/persona.service';
import { ReadingService, DivinationCategory } from '../reading/reading.service';
import { FortuneService } from '../fortune/fortune.service';
import { ChartService } from '../chart/chart.service';
import { AgentChatDto } from './dto/agent-chat.dto';

type AgentIntent = 'chat' | 'divination' | 'meditation' | 'chart' | 'fortune' | 'zi';

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
    
    const { intent, category, mood } = await this.classifyWithDeepSeek(dto, persona, userChart);
    const actions: Array<{ type: string; label: string }> = [];
    let artifacts: Record<string, unknown> = {};

    // map emotion to wealth for divination
    const divinationCategory = category === 'emotion' ? 'love' : category;

    if (intent === 'divination') {
      try {
        const reading = await this.readingService.generate({
          question: dto.message,
          category: category as DivinationCategory || divinationCategory as DivinationCategory || this.inferCategory(dto.message),
          userId: dto.userId,
        });
        artifacts = { reading };
        actions.push({
          type: 'view_reading',
          label: '查看完整解读',
        });
      } catch (error) {
        this.logger.error(`生成占卜失败: ${error.message}`);
        artifacts = { reading: null };
      }
    }

    if (intent === 'meditation') {
      const meditation = this.buildMeditation({ ...dto, mood });
      artifacts = { meditation };
      actions.push({
        type: 'start_meditation',
        label: '开始冥想',
      });
    }

    if (intent === 'fortune') {
      const fortune = this.fortuneService.getDailyFortune(dto.userId);
      artifacts = { fortune };
      actions.push({
        type: 'view_fortune',
        label: '查看今日运势',
      });
    }

    if (intent === 'chart') {
      artifacts = { 
        chart: userChart,
        hasChart: !!userChart,
      };
      if (userChart) {
        actions.push({
          type: 'view_chart',
          label: '查看命盘详情',
        });
      }
    }

    // 测字功能
    if (intent === 'zi') {
      const ziChar = this.extractZiFromMessage(dto.message);
      artifacts = { ziSuggestion: { zi: ziChar } };
      actions.push({
        type: 'view_zi',
        label: '进入测字页面',
      });
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
              content: `你是一个山海灵境的 AI 助手，负责在"聊天/占卜/冥想/命盘/运势/测字"之间选择最合适的工具。请只返回 JSON，不要夹杂其它文字。

可选意图：
- chat: 日常聊天、情绪倾诉、心理疏导
- divination: 用户想占卜、问卦、算命、问运势
- meditation: 用户焦虑、失眠、想静心
- chart: 用户想查看命盘、八字、个人分析
- fortune: 用户想看今日运势、抽签
- zi: 用户写了一个字要测字、问这个字怎么样

${contextInfo}`,
            },
            contextLines
              ? {
                  role: 'system',
                  content: `最近对话（由近到远）：\n${contextLines}\n\n请优先结合这些上下文来判断意图，不要只看最后一句。`,
                }
              : null,
            {
              role: 'user',
              content: JSON.stringify({
                message: dto.message,
                mood: dto.mood,
                persona: { id: persona.id, name: persona.name },
                hasChart: !!userChart,
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
      const intent: AgentIntent = validIntents.includes(parsed.intent) ? parsed.intent : 'chat';

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
    // 占卜相关关键词
    const divinationKeywords = ['占卜', '解读', '卦', '算一算', '问卜', '决定'];
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
    const contextLines = (dto.context || []).slice(-8);
    const conversationContext = [...recentMemory, ...contextLines].slice(-12).join('\n');

    try {
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

你的回复风格：
- toneTags: ${persona.toneTags.join('、')}
- 使用优雅、古风的语言，但不要过于晦涩
- 适当引用诗词典故增添文化韵味
- 理解用户的情感需求，给予温暖、有智慧的回应
- 每次回复控制在100-200字之间，保持简洁有力
- 如果用户提到命理相关内容，可以适当引用用户的八字信息给出个性化建议
- 绝对不要输出"角色名："前缀，不要输出舞台动作括号（如“（轻抚长须）”）
- 先回应用户当前语句的真实语义；如果信息不足，可温和追问，不要自说自话

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
    // 测字回复：只引导去测字页，不在对话内直接出结果
    if (intent === 'zi') {
      const suggestedZi = (artifacts as any)?.ziSuggestion?.zi;
      const ziHint = suggestedZi ? `（可先用「${suggestedZi}」起测）` : '';
      return `可以，我们去测字页面做更完整的仪式化解读。${ziHint}\n\n建议你先静心10秒，心里只想着这件事，再写下一个字，这样解读会更聚焦。\n\n点击下方「进入测字页面」开始。`;
    }

    // 占卜回复
    if (intent === 'divination' && artifacts.reading) {
      const reading = artifacts.reading as any;
      if (!reading) {
        return `抱歉，占卜服务暂时不可用，请稍后再试。`;
      }
      return `你的问题我已感知。\n\n🙏 所得卦象：${reading.hexagram.originalName}\n📖 解读：${reading.interpretation.overall}\n\n建议你：${reading.recommendations[0]}\n\n若想查看完整解读，可点击下方按钮。`;
    }

    // 冥想回复
    if (intent === 'meditation') {
      return `我感受到你内心的不静。\n\n让我们一起做几次深呼吸，放下那些困扰你的事情。\n\n我为你准备了一段冥想引导，点击下方「开始冥想」即可。`;
    }

    // 运势回复
    if (intent === 'fortune' && artifacts.fortune) {
      const fortune = artifacts.fortune as any;
      return `今日与你有缘。\n\n✨ 今日签诗：${fortune.poem.title}\n💫 运势：${fortune.day}\n\n幸运数字：${fortune.lucky.number} | 幸运颜色：${fortune.lucky.color}\n\n建议：${fortune.advice[0]}`;
    }

    // 命盘回复
    if (intent === 'chart') {
      if (userChart) {
        return `你的命盘已在此。\n\n🔮 八字：${userChart.dayGanZhi}（日主）\n🌟 五行：木${userChart.wuxingStrength.wood}% 火${userChart.wuxingStrength.fire}% 土${userChart.wuxingStrength.earth}% 金${userChart.wuxingStrength.metal}% 水${userChart.wuxingStrength.water}%\n\n📝 性格特点：${userChart.personalityTraits.slice(0, 2).join('、')}\n\n💼 事业：${userChart.fortuneSummary.career}\n💕 感情：${userChart.fortuneSummary.love}`;
      } else {
        return `你还没有建立命盘呢。\n\n若想了解自己的八字命盘，可以先去「我的」页面输入出生信息，我会为你生成专属命盘分析。`;
      }
    }

    // 日常聊天 - 使用AI生成真正的个性化回复
    if (intent === 'chat') {
      return await this.generateAIReply(message, persona, userChart, dto);
    }

    // 默认回复
    return `我听到了你的心绪。若想更进一步，可告诉我需要抽签、静坐还是查看命盘，我都在。`;
  }
}
