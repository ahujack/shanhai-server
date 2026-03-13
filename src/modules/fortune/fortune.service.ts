import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../../prisma.service';

export interface FortuneSlip {
  id: string;
  zodiac: string;       // 生肖
  zodiacAnimal: string;  // 动物名称
  day: string;          // 每日
  month: string;        // 每月
  year: string;        // 每年
  
  // 签诗
  poem: {
    title: string;
    line1: string;
    line2: string;
    line3: string;
    line4: string;
  };
  
  // 解释
  interpretation: {
    overall: string;
    love: string;
    career: string;
    wealth: string;
    health: string;
  };
  
  // 建议
  advice: string[];
  
  // 幸运元素
  lucky: {
    color: string;
    number: string;
    direction: string;
    food: string;
  };
  // 签运增强信息（可选，供前端娱乐化展示）
  fortuneRank?: '上上签' | '上签' | '中签' | '下签';
  fortuneScore?: number;
  fortuneTheme?: 'career' | 'love' | 'wealth' | 'health' | 'general';
  luckyTime?: string;
  drawCode?: string;
  funTip?: string;
  mission?: string;
  socialLine?: string;
}

// 完整签库 - 64 支签对应六十四卦
const fortuneSlips: FortuneSlip[] = [
  {
    id: '1',
    zodiac: '子',
    zodiacAnimal: '鼠',
    day: '今日运势平稳，宜静心养性',
    month: '本月宜积累，等待时机',
    year: '今年整体平稳把握机遇',
    poem: {
      title: '乾为天',
      line1: '天行健，君子以自强不息',
      line2: '飞龙在天，利见大人',
      line3: '九五至尊，万国来朝',
      line4: '亢龙有悔，适时而退',
    },
    interpretation: {
      overall: '卦象显示你正处于上升期，有贵人相助，适合施展抱负',
      love: '桃花运佳，有望遇到理想对象',
      career: '事业蒸蒸日上，适合开拓新领域',
      wealth: '财运亨通，但需谨慎投资',
      health: '身体健康，注意休息',
    },
    advice: ['把握当下机遇', '保持谦逊态度', '广结善缘'],
    lucky: { color: '金色', number: '5', direction: '东', food: '鸡肉' },
  },
  {
    id: '2',
    zodiac: '丑',
    zodiacAnimal: '牛',
    day: '今日宜稳扎稳打，循序渐进',
    month: '本月需耐心等待时机',
    year: '今年宜厚积薄发',
    poem: {
      title: '坤为地',
      line1: '地势坤，君子以厚德载物',
      line2: '含章可贞，或从王事',
      line3: '黄裳，元吉，文在中也',
      line4: '龙战于野，其血玄黄',
    },
    interpretation: {
      overall: '大吉之兆，但你需要有足够的耐心和德行来承载好运',
      love: '感情稳定，适合谈婚论嫁',
      career: '需稳扎稳打，不可急于求成',
      wealth: '收益平稳，不宜投机',
      health: '注意脾胃调养',
    },
    advice: ['修身养性', '稳中求进', '广结善缘'],
    lucky: { color: '黄色', number: '8', direction: '东北', food: '牛肉' },
  },
  {
    id: '3',
    zodiac: '寅',
    zodiacAnimal: '虎',
    day: '今日有意外之喜，但需谨慎',
    month: '本月事业上有突破',
    year: '今年宜主动出击',
    poem: {
      title: '水雷屯',
      line1: '屯如邅如，乘马班如',
      line2: '匪寇婚媾，女子贞不字',
      line3: '即鹿无虞，惟入于林中',
      line4: '乘马班如，泣血涟如',
    },
    interpretation: {
      overall: '万物初始阶段，虽有困难但前景光明',
      love: '有缘分的困扰，需耐心等待',
      career: '创业维艰，需坚持不懈',
      wealth: '先难后易，耐心积累',
      health: '注意头部健康',
    },
    advice: ['耐心等待时机', '不宜冒进', '寻求帮助'],
    lucky: { color: '蓝色', number: '3', direction: '东北', food: '鱼肉' },
  },
  {
    id: '4',
    zodiac: '卯',
    zodiacAnimal: '兔',
    day: '今日宜学习新知识',
    month: '本月智慧增长',
    year: '今年宜提升自我',
    poem: {
      title: '山水蒙',
      line1: '发蒙，利用刑人，用说桎梏',
      line2: '包蒙吉，纳妇吉，子克家',
      line3: '勿用取女，见金夫，不有躬',
      line4: '击蒙，不利为寇，利御寇',
    },
    interpretation: {
      overall: '蒙昧初开，适合学习启蒙，会有好老师指点',
      love: '少年纯真之恋，单纯美好',
      career: '需要学习积累，不宜急于求成',
      wealth: '财务上有收获，但需谨慎',
      health: '注意肝胆保养',
    },
    advice: ['虚心求学', '寻找良师', '启蒙智慧'],
    lucky: { color: '绿色', number: '4', direction: '东', food: '蔬菜' },
  },
  {
    id: '5',
    zodiac: '辰',
    zodiacAnimal: '龙',
    day: '今日需耐心等待机会',
    month: '本月宜积蓄能量',
    year: '今年是积累之年',
    poem: {
      title: '水天需',
      line1: '需于郊，利用恒，无咎',
      line2: '需于沙，小有言，终吉',
      line3: '需于泥，致寇至',
      line4: '需于血，出自穴',
    },
    interpretation: {
      overall: '需卦代表等待，时机未到时需耐心等待',
      love: '耐心等待，真爱终会出现',
      career: '储备能量，等待时机',
      wealth: '财务上有阻滞，但终会有收获',
      health: '注意泌尿系统',
    },
    advice: ['保持耐心', '积蓄能量', '等待时机'],
    lucky: { color: '白色', number: '6', direction: '西北', food: '米面' },
  },
  {
    id: '6',
    zodiac: '巳',
    zodiacAnimal: '蛇',
    day: '今日需避免争执',
    month: '本月人际关系需谨慎',
    year: '今年宜以和为贵',
    poem: {
      title: '天水讼',
      line1: '不永所事，小有言，终吉',
      line2: '不克讼，归而逋，其邑人三百户，无眚',
      line3: '食旧德，贞厉，终吉',
      line4: '不克讼，复即命，渝安贞，吉',
    },
    interpretation: {
      overall: '有争讼之象，宜以和为贵，避免与人冲突',
      love: '避免感情纠纷，平和相处',
      career: '易有竞争，保持低调',
      wealth: '有争财之象，和气生财',
      health: '注意心脏健康',
    },
    advice: ['以和为贵', '避免争执', '保持低调'],
    lucky: { color: '红色', number: '2', direction: '南', food: '羊肉' },
  },
  {
    id: '7',
    zodiac: '午',
    zodiacAnimal: '马',
    day: '今日宜团结协作',
    month: '本月宜发挥团队力量',
    year: '今年是合作之年',
    poem: {
      title: '地水师',
      line1: '师出以律，否臧凶',
      line2: '在师中吉，无咎，王三锡命',
      line3: '师或舆尸，凶',
      line4: '师左次，无咎',
    },
    interpretation: {
      overall: '师卦代表军队和群众，象征领导和组织能力',
      love: '需要包容和理解',
      career: '适合领导团队，共同作战',
      wealth: '众人拾柴火焰高',
      health: '注意足部健康',
    },
    advice: ['发挥领导力', '团结协作', '公平公正'],
    lucky: { color: '紫色', number: '7', direction: '西南', food: '猪肉' },
  },
  {
    id: '8',
    zodiac: '未',
    zodiacAnimal: '羊',
    day: '今日宜亲近贤者',
    month: '本月人缘佳',
    year: '今年贵人多助',
    poem: {
      title: '水地比',
      line1: '有孚比之，无咎',
      line2: '比之自内，贞吉',
      line3: '比之匪人',
      line4: '外比之，贞吉',
    },
    interpretation: {
      overall: '比卦代表亲比依附，适合结交志同道合之人',
      love: '桃花运旺，适合寻找伴侣',
      career: '易得贵人相助',
      wealth: '合作生财',
      health: '注意脾胃',
    },
    advice: ['广结善缘', '亲近贤者', '互利共赢'],
    lucky: { color: '粉色', number: '9', direction: '北', food: '豆腐' },
  },
  {
    id: '9',
    zodiac: '申',
    zodiacAnimal: '猴',
    day: '今日有小成但需继续努力',
    month: '本月有意外收获',
    year: '今年是积累之年',
    poem: {
      title: '风天小畜',
      line1: '复自道，何其咎，吉',
      line2: '牵复，吉',
      line3: '舆说辐，夫妻反目',
      line4: '有孚，血去惕出，无咎',
    },
    interpretation: {
      overall: '小畜代表小有积累，力量尚弱需继续努力',
      love: '有小波折但终会顺利',
      career: '有小小成就，不可骄傲',
      wealth: '积少成多，慎防破财',
      health: '注意肝脏',
    },
    advice: ['继续努力', '积少成多', '戒骄戒躁'],
    lucky: { color: '银色', number: '1', direction: '东南', food: '水果' },
  },
  {
    id: '10',
    zodiac: '酉',
    zodiacAnimal: '鸡',
    day: '今日宜谨慎行事',
    month: '本月需步步为营',
    year: '今年稳中求胜',
    poem: {
      title: '天泽履',
      line1: '素履往，无咎',
      line2: '履道坦坦，幽人贞吉',
      line3: '眇能视，跛能履，履虎尾咥人凶',
      line4: '夬履，贞厉',
    },
    interpretation: {
      overall: '履卦代表实践履行，需谨慎小心',
      love: '小心选择，不可草率',
      career: '稳步前进，注意风险',
      wealth: '财来不易，需谨慎',
      health: '注意足部',
    },
    advice: ['谨慎行事', '稳步前进', '防范风险'],
    lucky: { color: '金色', number: '5', direction: '西', food: '鸡肉' },
  },
  {
    id: '11',
    zodiac: '戌',
    zodiacAnimal: '狗',
    day: '今日诸事大吉',
    month: '本月运势旺盛',
    year: '今年是丰收之年',
    poem: {
      title: '地天泰',
      line1: '拔茅茹以其汇，征吉',
      line2: '包荒，用冯河，不遐遗',
      line3: '无平不陂，无往不复，艰贞无咎',
      line4: '帝乙归妹，以祉元吉',
    },
    interpretation: {
      overall: '泰卦代表通泰亨通，万事皆宜',
      love: '情投意合，婚姻美满',
      career: '仕途光明，升职加薪',
      wealth: '财运亨通，收获丰厚',
      health: '身心健康',
    },
    advice: ['乘胜追击', '把握机遇', '再接再厉'],
    lucky: { color: '绿色', number: '8', direction: '西北', food: '牛肉' },
  },
  {
    id: '12',
    zodiac: '亥',
    zodiacAnimal: '猪',
    day: '今日宜静守待机',
    month: '本月需耐心等待',
    year: '今年是蓄势之年',
    poem: {
      title: '天地否',
      line1: '拔茅茹以其汇，贞吉亨',
      line2: '包承，小人吉，大人否亨',
      line3: '包羞',
      line4: '有命无咎，畴离祉',
    },
    interpretation: {
      overall: '否卦代表闭塞不通，时机未到宜静守',
      love: '暂时沉寂，等待时机',
      career: '不宜冒进，积蓄力量',
      wealth: '财务紧张，节省为上',
      health: '注意呼吸系统',
    },
    advice: ['静守待机', '积蓄力量', '等待转机'],
    lucky: { color: '黑色', number: '4', direction: '东北', food: '猪肉' },
  },
];

const rankTiers: Array<{ label: FortuneSlip['fortuneRank']; min: number; max: number }> = [
  { label: '上上签', min: 85, max: 100 },
  { label: '上签', min: 70, max: 84 },
  { label: '中签', min: 45, max: 69 },
  { label: '下签', min: 20, max: 44 },
];

const luckyTimes = ['卯时 05:00-07:00', '巳时 09:00-11:00', '午时 11:00-13:00', '申时 15:00-17:00', '戌时 19:00-21:00'];
const funTips = [
  '今天适合先做最想拖延的那件事，运势会更顺。',
  '遇到选择题先深呼吸三次，再看第一直觉。',
  '出门前整理桌面 3 分钟，容易遇到好消息。',
  '把手机壁纸换成暖色，今日心态更稳。',
  '主动夸赞一个人，贵人运会抬头。',
];
const missionPool = [
  '今日小任务：完成一个 25 分钟专注冲刺。',
  '今日小任务：给未来的自己写一句鼓励。',
  '今日小任务：走路 15 分钟，边走边想一件好事。',
  '今日小任务：做一个“先开始 5 分钟”行动。',
  '今日小任务：把待办清单减少 1 项。',
];
const socialLines = [
  '今日签语：好运在路上，行动是最好的开运符。',
  '今日签语：念头一转，局面就会慢慢转好。',
  '今日签语：先稳住自己，再推进事情。',
  '今日签语：好结果往往来自一次小小坚持。',
];

@Injectable()
export class FortuneService {
  private readonly logger = new Logger(FortuneService.name);

  constructor(private prisma: PrismaService) {}

  private lastUserId: string | null = null;
  private lastDate: string | null = null;
  private cachedSlip: FortuneSlip | null = null;

  private hashString(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = (hash << 5) - hash + input.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  private createRng(seed: number): () => number {
    let t = seed + 0x6d2b79f5;
    return () => {
      t += 0x6d2b79f5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  private pick<T>(arr: T[], rng: () => number): T {
    return arr[Math.floor(rng() * arr.length)];
  }

  private inferTheme(slip: FortuneSlip): FortuneSlip['fortuneTheme'] {
    const text = `${slip.interpretation.career} ${slip.interpretation.love} ${slip.interpretation.wealth} ${slip.interpretation.health}`.toLowerCase();
    if (/(事业|升职|团队|创业|竞争)/.test(text)) return 'career';
    if (/(感情|桃花|婚姻|恋|伴侣)/.test(text)) return 'love';
    if (/(财运|收益|投资|破财|生财)/.test(text)) return 'wealth';
    if (/(健康|脾胃|心脏|肝|呼吸|休息)/.test(text)) return 'health';
    return 'general';
  }

  private themeLabel(theme: FortuneSlip['fortuneTheme']): string {
    const mapping: Record<NonNullable<FortuneSlip['fortuneTheme']>, string> = {
      career: '事业',
      love: '感情',
      wealth: '财运',
      health: '健康',
      general: '综合',
    };
    return mapping[theme || 'general'];
  }

  private scoreFortune(slip: FortuneSlip, rng: () => number): number {
    const text = `${slip.day} ${slip.month} ${slip.year} ${slip.interpretation.overall}`;
    let score = 62;
    if (/(大吉|亨通|旺盛|丰收|贵人|顺利)/.test(text)) score += 24;
    if (/(平稳|积累|稳步|等待时机)/.test(text)) score += 8;
    if (/(阻滞|争执|闭塞|凶|谨慎|不宜)/.test(text)) score -= 18;
    score += Math.floor(rng() * 8) - 3; // 轻随机，增强变化感
    return Math.max(20, Math.min(100, score));
  }

  private rankFromScore(score: number): FortuneSlip['fortuneRank'] {
    return rankTiers.find((tier) => score >= tier.min && score <= tier.max)?.label || '中签';
  }

  private decorateSlip(base: FortuneSlip, rng: () => number, seedKey: string): FortuneSlip {
    const score = this.scoreFortune(base, rng);
    const rank = this.rankFromScore(score);
    const theme = this.inferTheme(base);
    const luckTime = this.pick(luckyTimes, rng);
    const funTip = this.pick(funTips, rng);
    const mission = this.pick(missionPool, rng);
    const socialLine = this.pick(socialLines, rng);
    const drawCode = `SH-${seedKey.slice(0, 4).toUpperCase()}-${Math.floor(rng() * 900 + 100)}`;

    const advice = [...base.advice];
    if (!advice.includes(mission)) {
      advice.push(mission);
    }

    return {
      ...base,
      day: `${base.day}｜${rank} · ${luckTime}`,
      interpretation: {
        ...base.interpretation,
        overall: `${base.interpretation.overall}（今日主题：${this.themeLabel(theme)}）`,
      },
      advice: advice.slice(0, 4),
      fortuneRank: rank,
      fortuneScore: score,
      fortuneTheme: theme,
      luckyTime: luckTime,
      drawCode,
      funTip,
      mission,
      socialLine,
    };
  }

  private async enhanceWithLLM(slip: FortuneSlip): Promise<FortuneSlip> {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return slip;
    try {
      const poemText = `${slip.poem.title}：${slip.poem.line1} ${slip.poem.line2} ${slip.poem.line3} ${slip.poem.line4}`;
      const res = await axios.post(
        process.env.DEEPSEEK_API_URL ?? 'https://api.deepseek.com/chat/completions',
        {
          model: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
          temperature: 0.8,
          max_tokens: 2000,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `你是签诗解读师。根据签诗内容，为 overall/love/career/wealth/health 各生成 80-150 字的个性化解读，advice 生成 3-4 条可执行建议。每条必须不同、结合签诗意象，禁止雷同和套话。`,
            },
            {
              role: 'user',
              content: JSON.stringify({
                签诗: poemText,
                原解读: slip.interpretation,
                签运: slip.fortuneRank,
              }),
            },
          ],
        },
        {
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          timeout: 20000,
        },
      );
      const raw = res.data?.choices?.[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(String(raw).replace(/```json\n?|\n?```/g, '').trim());
      return {
        ...slip,
        interpretation: {
          overall: String(parsed.overall ?? slip.interpretation.overall).slice(0, 500),
          love: String(parsed.love ?? slip.interpretation.love).slice(0, 300),
          career: String(parsed.career ?? slip.interpretation.career).slice(0, 300),
          wealth: String(parsed.wealth ?? slip.interpretation.wealth).slice(0, 300),
          health: String(parsed.health ?? slip.interpretation.health).slice(0, 300),
        },
        advice: Array.isArray(parsed.advice) && parsed.advice.length
          ? parsed.advice.slice(0, 4).map((a: unknown) => String(a ?? '').slice(0, 80))
          : slip.advice,
      };
    } catch (err) {
      this.logger.warn(`抽签 LLM 增强失败: ${(err as Error).message}`);
      return slip;
    }
  }

  // 获取今日运势
  async getDailyFortune(userId?: string): Promise<FortuneSlip> {
    const today = new Date().toISOString().split('T')[0];
    
    // 同一用户同一天返回相同签
    if (this.lastUserId === userId && this.lastDate === today && this.cachedSlip) {
      return this.cachedSlip;
    }
    
    // 根据日期和用户ID生成一致的签
    const seedKey = `${userId || 'guest'}_${today}`;
    const seed = this.hashString(seedKey);
    const rng = this.createRng(seed);
    
    const index = seed % fortuneSlips.length;
    let slip = this.decorateSlip(fortuneSlips[index], rng, seedKey);
    slip = await this.enhanceWithLLM(slip);

    // 缓存
    this.lastUserId = userId || null;
    this.lastDate = today;
    this.cachedSlip = slip;

    return slip;
  }

  // 获取指定位置的签
  getSlipByIndex(index: number): FortuneSlip {
    return fortuneSlips[index % fortuneSlips.length];
  }

  // 随机抽签
  async drawRandomSlip(): Promise<FortuneSlip> {
    const nowSeed = `${Date.now()}_${Math.random()}`;
    const seed = this.hashString(nowSeed);
    const rng = this.createRng(seed);

    // 让抽签更有娱乐波动：优先抽中签与上签，保留少量下签
    const rankRoulette = rng();
    let preferredRank: FortuneSlip['fortuneRank'] = '中签';
    if (rankRoulette > 0.88) preferredRank = '上上签';
    else if (rankRoulette > 0.62) preferredRank = '上签';
    else if (rankRoulette < 0.15) preferredRank = '下签';

    const decoratedPool = fortuneSlips.map((slip, idx) =>
      this.decorateSlip(slip, this.createRng(seed + idx * 17), `${seed}_${idx}`),
    );
    const rankedPool = decoratedPool.filter((slip) => slip.fortuneRank === preferredRank);
    const pickPool = rankedPool.length ? rankedPool : decoratedPool;
    const slip = this.pick(pickPool, rng);
    return this.enhanceWithLLM(slip);
  }
}
