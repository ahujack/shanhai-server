import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import axios from 'axios';
import solarlunar from 'solarlunar';

type MembershipTier = 'free' | 'premium' | 'vip';

export interface BaziChart {
  userId: string;
  birthDate: string;
  birthTime: string;
  gender: 'male' | 'female';
  
  // 八字
  yearGanZhi: string;  // 年柱
  monthGanZhi: string; // 月柱
  dayGanZhi: string;   // 日柱
  hourGanZhi: string;  // 时柱
  
  // 十神
  dayMaster: string;   // 日主
  tenGods: {
    year: string;
    month: string;
    day: string;
    hour: string;
    summary: string[];
  };
  sun: string;         // 命宫太阳
  moon: string;        // 命宫月亮
  
  // 五行强弱
  wuxingStrength: {
    wood: number;
    fire: number;
    earth: number;
    metal: number;
    water: number;
  };
  
  // 性格特点
  personalityTraits: string[];
  
  // 运势简述
  fortuneSummary: {
    career: string;
    wealth: string;
    love: string;
    health: string;
  };
  
  // 建议
  suggestions: string[];

  // 总论（先给结论）
  conclusion: {
    overall: string;
    mindset: string;
  };

  // 详细解读（增强可读性）
  detailedReading: {
    corePattern: string;
    relationship: string;
    career: string;
    wealth: string;
    health: string;
    decadeRhythm: string[];
    luckCycles: {
      startAge: number;
      direction: 'forward' | 'backward';
      cycles: Array<{
        ageRange: string;
        ganZhi: string;
        focus: string;
      }>;
    };
    annualForecast: Array<{
      year: number;
      ganZhi: string;
      tenGod: string;
      hint: string;
      favorable: string;
      caution: string;
      windowMonths: string[];
      masterCommentary?: string;
    }>;
    yearlyTips: string[];
    paywallHint?: string;
    disclaimer: string;
  };
}

type LuckReadingPatch = Partial<{
  corePattern: string;
  relationship: string;
  career: string;
  wealth: string;
  health: string;
  decadeRhythm: string[];
  yearlyTips: string[];
}>;

@Injectable()
export class ChartService {
  private readonly logger = new Logger(ChartService.name);
  private readonly llmCache = new Map<string, { expiresAt: number; patch: LuckReadingPatch }>();

  constructor(private prisma: PrismaService) {}
  
  // 天干
  private gan = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  // 地支
  private zhi = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  
  async generateChart(
    userId: string, 
    birthDate: string, 
    birthTime: string, 
    gender: 'male' | 'female',
    options?: {
      calendarType?: 'solar' | 'lunar';
      isLeapMonth?: boolean;
      birthLongitude?: number;
      timezone?: string;
      membership?: MembershipTier;
    },
  ): Promise<BaziChart> {
    const resolvedSolarDate = this.resolveSolarDate(
      birthDate,
      options?.calendarType || 'solar',
      options?.isLeapMonth || false,
    );
    // 解析日期（农历先转阳历）
    const date = new Date(resolvedSolarDate);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    const [hour, minute] = birthTime.split(':').map(Number);
    const correctedTime = this.applyTrueSolarTimeCorrection(
      year,
      month,
      day,
      hour,
      minute,
      options?.birthLongitude,
      options?.timezone,
    );
    
    // 计算八字
    const yearGZ = this.calculateYearGanZhi(year);
    const monthGZ = this.calculateMonthGanZhi(year, month);
    const dayGZ = this.calculateDayGanZhi(year, month, day);
    const hourGZ = this.calculateHourGanZhi(dayGZ, correctedTime.hour);
    
    // 日主（日柱天干）
    const dayMaster = dayGZ.charAt(0);
    
    // 计算五行强度
    const wuxingStrength = this.calculateWuxingStrength(yearGZ, monthGZ, dayGZ, hourGZ);
    
    // 生成性格特点
    const personalityTraits = this.analyzePersonality(dayMaster, wuxingStrength);
    
    // 运势简述
    const fortuneSummary = this.analyzeFortune(dayMaster, wuxingStrength, gender);
    
    // 建议
    const suggestions = this.generateSuggestions(dayMaster, wuxingStrength);
    const tenGods = this.calculateTenGods(yearGZ, monthGZ, dayGZ, hourGZ, dayMaster);
    const conclusion = this.generateConclusion(dayMaster, wuxingStrength, tenGods);
    const baseDetailedReading = this.generateDetailedReading(
      dayMaster,
      year,
      month,
      day,
      monthGZ,
      wuxingStrength,
      tenGods,
      fortuneSummary,
      gender,
    );
    const detailedReading = await this.enhanceDetailedReadingWithLLM({
      userId,
      birthDate,
      birthTime,
      resolvedSolarDate,
      correctedTime,
      birthLongitude: options?.birthLongitude,
      timezone: options?.timezone || 'Asia/Shanghai',
      yearGanZhi: yearGZ,
      monthGanZhi: monthGZ,
      dayGanZhi: dayGZ,
      hourGanZhi: hourGZ,
      dayMaster,
      tenGods,
      wuxingStrength,
      baseDetailedReading,
      membership: options?.membership || 'free',
    });
    
    const chart: BaziChart = {
      userId,
      birthDate,
      birthTime,
      gender,
      yearGanZhi: yearGZ,
      monthGanZhi: monthGZ,
      dayGanZhi: dayGZ,
      hourGanZhi: hourGZ,
      dayMaster,
      tenGods,
      sun: this.getSunSign(month, day),
      moon: this.getMoonSign(month),
      wuxingStrength: wuxingStrength as { wood: number; fire: number; earth: number; metal: number; water: number },
      personalityTraits,
      fortuneSummary,
      suggestions,
      conclusion,
      detailedReading,
    };

    // 保存到数据库（使用 upsert，如果已存在则更新）
    await this.prisma.baziChart.upsert({
      where: { userId },
      update: {
        birthDate,
        birthTime,
        gender,
        yearGanZhi: yearGZ,
        monthGanZhi: monthGZ,
        dayGanZhi: dayGZ,
        hourGanZhi: hourGZ,
        dayMaster,
        sun: chart.sun,
        moon: chart.moon,
        wuxingStrength: JSON.stringify(wuxingStrength),
        personalityTraits: JSON.stringify(personalityTraits),
        fortuneSummary: JSON.stringify(fortuneSummary),
        suggestions: JSON.stringify(suggestions),
        updatedAt: new Date(),
      },
      create: {
        userId,
        birthDate,
        birthTime,
        gender,
        yearGanZhi: yearGZ,
        monthGanZhi: monthGZ,
        dayGanZhi: dayGZ,
        hourGanZhi: hourGZ,
        dayMaster,
        sun: chart.sun,
        moon: chart.moon,
        wuxingStrength: JSON.stringify(wuxingStrength),
        personalityTraits: JSON.stringify(personalityTraits),
        fortuneSummary: JSON.stringify(fortuneSummary),
        suggestions: JSON.stringify(suggestions),
      },
    });

    return chart;
  }
  
  async findOne(userId: string, membership: MembershipTier = 'free'): Promise<BaziChart | null> {
    const chart = await this.prisma.baziChart.findUnique({
      where: { userId },
    });

    if (!chart) {
      return null;
    }

    return await this.formatChart(chart, membership);
  }

  // 格式化数据库中的图表数据
  private async formatChart(chart: any, membership: MembershipTier = 'free'): Promise<BaziChart> {
    const baseDetailedReading = this.generateDetailedReading(
      chart.dayMaster,
      Number(String(chart.birthDate).slice(0, 4)),
      Number(String(chart.birthDate).slice(5, 7)),
      Number(String(chart.birthDate).slice(8, 10)),
      chart.monthGanZhi,
      JSON.parse(chart.wuxingStrength),
      this.calculateTenGods(chart.yearGanZhi, chart.monthGanZhi, chart.dayGanZhi, chart.hourGanZhi, chart.dayMaster),
      JSON.parse(chart.fortuneSummary),
      chart.gender as 'male' | 'female',
    );
    const [hour, minute] = String(chart.birthTime || '00:00').split(':').map(Number);
    const correctedTime = this.applyTrueSolarTimeCorrection(
      Number(String(chart.birthDate).slice(0, 4)),
      Number(String(chart.birthDate).slice(5, 7)),
      Number(String(chart.birthDate).slice(8, 10)),
      Number.isFinite(hour) ? hour : 0,
      Number.isFinite(minute) ? minute : 0,
      undefined,
      'Asia/Shanghai',
    );
    const detailedReading = await this.enhanceDetailedReadingWithLLM({
      userId: chart.userId,
      birthDate: chart.birthDate,
      birthTime: chart.birthTime,
      resolvedSolarDate: chart.birthDate,
      correctedTime,
      timezone: 'Asia/Shanghai',
      yearGanZhi: chart.yearGanZhi,
      monthGanZhi: chart.monthGanZhi,
      dayGanZhi: chart.dayGanZhi,
      hourGanZhi: chart.hourGanZhi,
      dayMaster: chart.dayMaster,
      tenGods: this.calculateTenGods(chart.yearGanZhi, chart.monthGanZhi, chart.dayGanZhi, chart.hourGanZhi, chart.dayMaster),
      wuxingStrength: JSON.parse(chart.wuxingStrength),
      baseDetailedReading,
      membership,
    });

    return {
      userId: chart.userId,
      birthDate: chart.birthDate,
      birthTime: chart.birthTime,
      gender: chart.gender as 'male' | 'female',
      yearGanZhi: chart.yearGanZhi,
      monthGanZhi: chart.monthGanZhi,
      dayGanZhi: chart.dayGanZhi,
      hourGanZhi: chart.hourGanZhi,
      dayMaster: chart.dayMaster,
      tenGods: this.calculateTenGods(
        chart.yearGanZhi,
        chart.monthGanZhi,
        chart.dayGanZhi,
        chart.hourGanZhi,
        chart.dayMaster,
      ),
      sun: chart.sun,
      moon: chart.moon,
      wuxingStrength: JSON.parse(chart.wuxingStrength),
      personalityTraits: JSON.parse(chart.personalityTraits),
      fortuneSummary: JSON.parse(chart.fortuneSummary),
      suggestions: JSON.parse(chart.suggestions),
      conclusion: this.generateConclusion(
        chart.dayMaster,
        JSON.parse(chart.wuxingStrength),
        this.calculateTenGods(chart.yearGanZhi, chart.monthGanZhi, chart.dayGanZhi, chart.hourGanZhi, chart.dayMaster),
      ),
      detailedReading,
    };
  }
  
  // 计算年柱
  private calculateYearGanZhi(year: number): string {
    const ganIndex = (year - 4) % 10;
    const zhiIndex = (year - 4) % 12;
    return this.gan[ganIndex] + this.zhi[zhiIndex];
  }
  
  // 计算月柱
  private calculateMonthGanZhi(year: number, month: number): string {
    const yearGanIndex = (year - 4) % 10;
    // 月柱天干：年干 × 2 + 月份
    const monthGanIndex = (yearGanIndex * 2 + month) % 10;
    const monthZhiIndex = (month + 1) % 12;
    return this.gan[monthGanIndex] + this.zhi[monthZhiIndex];
  }
  
  // 计算日柱（简化版）
  private calculateDayGanZhi(year: number, month: number, day: number): string {
    // 使用蔡勒公式变体计算天数偏移
    const baseDate = new Date(1900, 0, 1);
    const targetDate = new Date(year, month - 1, day);
    const days = Math.floor((targetDate.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
    
    const ganIndex = (days + 50) % 10;
    const zhiIndex = (days + 56) % 12;
    
    return this.gan[ganIndex] + this.zhi[zhiIndex];
  }
  
  // 计算时柱
  private calculateHourGanZhi(dayGZ: string, hour: number): string {
    const dayGan = dayGZ.charAt(0);
    const dayGanIndex = this.gan.indexOf(dayGan);
    // 时柱地支：23:00-1:00 为子时
    const hourZhiIndex = Math.floor((hour + 1) / 2) % 12;
    // 时柱天干：日干 × 2 + 时支
    const hourGanIndex = (dayGanIndex * 2 + hourZhiIndex) % 10;
    
    return this.gan[hourGanIndex] + this.zhi[hourZhiIndex];
  }

  private resolveSolarDate(
    inputDate: string,
    calendarType: 'solar' | 'lunar',
    isLeapMonth: boolean,
  ): string {
    if (calendarType !== 'lunar') {
      return inputDate;
    }

    const [year, month, day] = inputDate.split('-').map(Number);
    if (!year || !month || !day) {
      return inputDate;
    }

    try {
      const solar = (solarlunar as any).lunar2solar(year, month, day, isLeapMonth);
      if (!solar || !solar.cYear) return inputDate;
      const mm = String(solar.cMonth).padStart(2, '0');
      const dd = String(solar.cDay).padStart(2, '0');
      return `${solar.cYear}-${mm}-${dd}`;
    } catch {
      return inputDate;
    }
  }

  private applyTrueSolarTimeCorrection(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    longitude?: number,
    timezone?: string,
  ): { hour: number; minute: number } {
    if (longitude === undefined || longitude === null || Number.isNaN(longitude)) {
      return { hour, minute };
    }

    const offsetHours = this.getTimezoneOffsetHours(timezone || 'Asia/Shanghai', new Date(year, month - 1, day, hour, minute));
    const standardMeridian = offsetHours * 15;
    const correctionMinutes = Math.round((longitude - standardMeridian) * 4);

    const date = new Date(year, month - 1, day, hour, minute);
    date.setMinutes(date.getMinutes() + correctionMinutes);
    return { hour: date.getHours(), minute: date.getMinutes() };
  }

  private getTimezoneOffsetHours(timezone: string, date: Date): number {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'shortOffset',
      }).formatToParts(date);
      const zonePart = parts.find((part) => part.type === 'timeZoneName')?.value || 'GMT+0';
      const match = zonePart.match(/GMT([+-]\d{1,2})(?::?(\d{2}))?/);
      if (!match) return 0;
      const hour = Number(match[1]);
      const minute = Number(match[2] || '0');
      return hour + minute / 60;
    } catch {
      return 0;
    }
  }
  
  // 获取太阳星座
  private getSunSign(month: number, day: number): string {
    const suns = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
    const solarTerms = [20, 19, 21, 21, 21, 21, 23, 23, 23, 23, 22, 22];
    const idx = month - 1;
    return day < solarTerms[idx] ? suns[(idx + 11) % 12] : suns[idx];
  }
  
  // 获取月亮星座（简化为月相）
  private getMoonSign(month: number): string {
    const moons = ['朔月', '峨眉月', '上弦月', '盈凸月', '满月', '亏凸月', '下弦月', '残月'];
    // 使用当前日期的月相（简化）
    const day = new Date().getDate();
    const phase = Math.floor((day - 1) / 4) % 8;
    return moons[phase];
  }
  
  // 计算五行强度
  private calculateWuxingStrength(
    yearGZ: string, 
    monthGZ: string, 
    dayGZ: string, 
    hourGZ: string
  ): Record<string, number> {
    // 天干对应的五行
    const wuxing: Record<string, string[]> = {
      wood: ['甲', '乙'],
      fire: ['丙', '丁'],
      earth: ['戊', '己'],
      metal: ['庚', '辛'],
      water: ['壬', '癸'],
    };
    
    // 地支对应的五行
    const zhiWuxing: Record<string, string> = {
      '寅': 'wood', '卯': 'wood', 
      '巳': 'fire', '午': 'fire',
      '辰': 'earth', '丑': 'earth', '未': 'earth', '戌': 'earth',
      '申': 'metal', '酉': 'metal',
      '子': 'water', '亥': 'water',
    };
    
    const allGZ = yearGZ + monthGZ + dayGZ + hourGZ;
    const strength = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
    
    // 统计天干五行
    for (const char of allGZ) {
      for (const [wx, chars] of Object.entries(wuxing)) {
        if (chars.includes(char)) {
          strength[wx]++;
        }
      }
      // 统计地支五行
      if (zhiWuxing[char]) {
        strength[zhiWuxing[char]]++;
      }
    }
    
    // 归一化到 0-100
    const total = Object.values(strength).reduce((a, b) => a + b, 0);
    for (const key of Object.keys(strength)) {
      strength[key] = Math.round((strength[key] / total) * 100);
    }
    
    return strength;
  }
  
  // 分析性格
  private analyzePersonality(dayMaster: string, wuxing: Record<string, number>): string[] {
    const traits: string[] = [];
    
    const dayMasterWuxing: Record<string, string> = {
      '甲': 'wood', '乙': 'wood', 
      '丙': 'fire', '丁': 'fire',
      '戊': 'earth', '己': 'earth', 
      '庚': 'metal', '辛': 'metal',
      '壬': 'water', '癸': 'water',
    };
    
    const wx = dayMasterWuxing[dayMaster];
    
    // 性格关键词映射
    const personalityMap: Record<string, string[]> = {
      wood: ['富有生', '仁慈', '乐观', '喜欢新事物'],
      fire: ['热情', '积极', '有活力', '执行力强'],
      earth: ['稳重', '务实', '诚信', '有耐心'],
      metal: ['果断', '正义', '有原则', '事业心强'],
      water: ['智慧', '灵活', '善于沟通', '适应力强'],
    };
    
    traits.push(...personalityMap[wx] || []);
    
    // 根据五行强弱补充
    const maxWx = Object.entries(wuxing).reduce((a, b) => a[1] > b[1] ? a : b)[0];
    const minWx = Object.entries(wuxing).reduce((a, b) => a[1] < b[1] ? a : b)[0];
    
    if (wuxing[wx] >= 30) {
      traits.push(`${wx}性偏旺，有领导气质`);
    } else if (wuxing[wx] <= 15) {
      traits.push(`${wx}性偏弱，需要更多滋养`);
    }
    
    return traits;
  }
  
  // 分析运势
  private analyzeFortune(
    dayMaster: string, 
    wuxing: Record<string, number>, 
    gender: 'male' | 'female'
  ): { career: string; wealth: string; love: string; health: string } {
    const dayMasterWuxing: Record<string, string> = {
      '甲': 'wood', '乙': 'wood', '丙': 'fire', '丁': 'fire',
      '戊': 'earth', '己': 'earth', '庚': 'metal', '辛': 'metal',
      '壬': 'water', '癸': 'water',
    };
    
    const wx = dayMasterWuxing[dayMaster];
    const isStrong = wuxing[wx] >= 25;
    
    const career = isStrong 
      ? '事业心强，适合管理或创业方向'
      : '适合技术路线或专业领域深耕';
    
    const wealth = wuxing.earth >= 25 || wuxing.metal >= 25
      ? '财运较好，善于理财'
      : '财运需要靠努力积累';
    
    const love = gender === 'male'
      ? (wuxing.water >= 20 ? '异性缘佳，情感丰富' : '专一深情，需要主动表达')
      : (wuxing.fire >= 20 ? '魅力十足，桃花朵朵' : '内敛含蓄，缘分需要等待');
    
    const health = ['wood', 'fire', 'earth', 'metal', 'water'].map(w => {
      if (wuxing[w] < 10) {
        const healthMap: Record<string, string> = {
          wood: '注意肝胆', fire: '注意心脏', earth: '注意脾胃', 
          metal: '注意肺部', water: '注意肾部'
        };
        return healthMap[w];
      }
      return null;
    }).filter(Boolean).join('、') || '整体健康良好';
    
    return { career, wealth, love, health };
  }
  
  // 生成建议
  private generateSuggestions(dayMaster: string, wuxing: Record<string, number>): string[] {
    const suggestions: string[] = [];
    
    const dayMasterWuxing: Record<string, string> = {
      '甲': 'wood', '乙': 'wood', '丙': 'fire', '丁': 'fire',
      '戊': 'earth', '己': 'earth', '庚': 'metal', '辛': 'metal',
      '壬': 'water', '癸': 'water',
    };
    
    const wx = dayMasterWuxing[dayMaster];
    
    // 喜用神建议
    const favorWx = Object.entries(wuxing)
      .filter(([k, v]) => v >= 20 && k !== wx)
      .sort((a, b) => b[1] - a[1])[0];
    
    if (favorWx) {
      suggestions.push(`宜加强${favorWx[0]}的能量，可通过服饰、颜色或环境布局调整`);
    }
    
    // 职业建议
    const careerMap: Record<string, string> = {
      wood: '教育、文化、艺术、新媒体',
      fire: '能源、互联网、餐饮、娱乐',
      earth: '房地产、建筑、农业、珠宝',
      metal: '金融、法律、珠宝、机械',
      water: '物流、旅游、贸易、咨询',
    };
    
    suggestions.push(`适合职业方向：${careerMap[wx]}`);
    
    // 养生建议
    const healthMap: Record<string, string> = {
      wood: '保持充足睡眠，适度运动',
      fire: '清淡饮食，避免过度兴奋',
      earth: '规律饮食，注意脾胃调养',
      metal: '注意呼吸系统，适当锻炼',
      water: '保持温暖，适度补水',
    };
    
    suggestions.push(`养生重点：${healthMap[wx]}`);
    
    return suggestions;
  }

  private calculateTenGods(
    yearGZ: string,
    monthGZ: string,
    dayGZ: string,
    hourGZ: string,
    dayMaster: string,
  ): BaziChart['tenGods'] {
    const yearStem = yearGZ.charAt(0);
    const monthStem = monthGZ.charAt(0);
    const dayStem = dayGZ.charAt(0);
    const hourStem = hourGZ.charAt(0);

    const yearGod = this.getTenGod(dayMaster, yearStem);
    const monthGod = this.getTenGod(dayMaster, monthStem);
    const dayGod = '日主';
    const hourGod = this.getTenGod(dayMaster, hourStem);

    const summary = [
      `年柱见${yearGod}，早年环境与原生家庭对你影响较深。`,
      `月柱见${monthGod}，工作方式与社会角色会更偏向这种能量。`,
      `时柱见${hourGod}，中后期发展与长期目标会往这个方向生长。`,
    ];

    return { year: yearGod, month: monthGod, day: dayGod, hour: hourGod, summary };
  }

  private getTenGod(dayMaster: string, targetStem: string): string {
    const stemMeta: Record<string, { element: 'wood' | 'fire' | 'earth' | 'metal' | 'water'; polarity: 'yang' | 'yin' }> = {
      '甲': { element: 'wood', polarity: 'yang' },
      '乙': { element: 'wood', polarity: 'yin' },
      '丙': { element: 'fire', polarity: 'yang' },
      '丁': { element: 'fire', polarity: 'yin' },
      '戊': { element: 'earth', polarity: 'yang' },
      '己': { element: 'earth', polarity: 'yin' },
      '庚': { element: 'metal', polarity: 'yang' },
      '辛': { element: 'metal', polarity: 'yin' },
      '壬': { element: 'water', polarity: 'yang' },
      '癸': { element: 'water', polarity: 'yin' },
    };
    const generateMap: Record<string, string> = {
      wood: 'fire',
      fire: 'earth',
      earth: 'metal',
      metal: 'water',
      water: 'wood',
    };
    const controlMap: Record<string, string> = {
      wood: 'earth',
      fire: 'metal',
      earth: 'water',
      metal: 'wood',
      water: 'fire',
    };

    const master = stemMeta[dayMaster];
    const target = stemMeta[targetStem];
    if (!master || !target) return '平衡';

    const samePolarity = master.polarity === target.polarity;

    if (master.element === target.element) return samePolarity ? '比肩' : '劫财';
    if (generateMap[master.element] === target.element) return samePolarity ? '食神' : '伤官'; // 我生
    if (generateMap[target.element] === master.element) return samePolarity ? '偏印' : '正印'; // 生我
    if (controlMap[master.element] === target.element) return samePolarity ? '偏财' : '正财'; // 我克
    if (controlMap[target.element] === master.element) return samePolarity ? '七杀' : '正官'; // 克我
    return '平衡';
  }

  private generateConclusion(
    dayMaster: string,
    wuxing: Record<string, number>,
    tenGods: BaziChart['tenGods'],
  ): BaziChart['conclusion'] {
    const dominant = Object.entries(wuxing).sort((a, b) => b[1] - a[1])[0]?.[0] || 'earth';
    const weakness = Object.entries(wuxing).sort((a, b) => a[1] - b[1])[0]?.[0] || 'water';
    const keyGod = tenGods.month;
    const elementName: Record<string, string> = {
      wood: '木',
      fire: '火',
      earth: '土',
      metal: '金',
      water: '水',
    };

    return {
      overall: `你是${dayMaster}日主，当前命盘核心呈现“${keyGod}”气质，主轴是先稳住内核，再扩展外部机会。`,
      mindset: `五行以${elementName[dominant] || '土'}偏旺、${elementName[weakness] || '水'}偏弱，建议以“长期主义 + 节奏感”来做人生决策，避免情绪化硬冲。`,
    };
  }

  private generateDetailedReading(
    dayMaster: string,
    birthYear: number,
    birthMonth: number,
    birthDay: number,
    monthGanZhi: string,
    wuxing: Record<string, number>,
    tenGods: BaziChart['tenGods'],
    fortuneSummary: BaziChart['fortuneSummary'],
    gender: 'male' | 'female',
  ): BaziChart['detailedReading'] {
    const dominant = Object.entries(wuxing).sort((a, b) => b[1] - a[1])[0]?.[0] || 'earth';
    const weakest = Object.entries(wuxing).sort((a, b) => a[1] - b[1])[0]?.[0] || 'water';

    const elementName: Record<string, string> = {
      wood: '木',
      fire: '火',
      earth: '土',
      metal: '金',
      water: '水',
    };

    const corePattern =
      `你的盘面以${elementName[dominant]}为主导、${elementName[weakest]}相对偏弱，` +
      `内在驱动力来自“${tenGods.month}”这条线。` +
      `这通常意味着你在关键选择上很看重长期稳定，但在高压力阶段容易出现“想得很多、动得偏谨慎”的特征。`;

    const relationshipBase =
      gender === 'male'
        ? `感情模式偏“先责任后情绪”。你会希望关系有确定感，不太喜欢长期悬而未决。` +
          `当你感到失控时，可能会选择沉默或独自消化，建议把“真实感受”提前表达，减少误解累积。`
        : `感情模式偏“先感受后判断”。你对关系细节敏感，能够捕捉对方情绪变化。` +
          `建议在关键节点明确边界和期待，避免长期内耗式揣测。`;

    const careerBase =
      `事业上你更适合“可积累的赛道”而非纯短期博弈。${fortuneSummary.career}。` +
      `若进入新阶段，建议先用3-6周做小范围验证，再决定是否加码投入。`;

    const wealthBase =
      `财务节奏强调“稳态现金流 + 结构化增长”。${fortuneSummary.wealth}。` +
      `你对风险并不迟钝，但容易在情绪波动时做过度保守或过度补仓，两者都要避免。`;

    const health =
      `身心层面需要重点关注“压力恢复能力”。${fortuneSummary.health}。` +
      `当你睡眠质量下降或注意力分散时，往往就是节奏过满的信号，先修复作息比硬撑更有效。`;

    const decadeRhythm = [
      '20-29岁：打基础与定位阶段，重点是选对赛道，不是求快。',
      '30-39岁：能力兑现阶段，适合放大已有优势并建立个人方法论。',
      '40-49岁：结构升级阶段，宜从“亲力亲为”走向“系统化协同”。',
      '50岁以后：稳定收敛阶段，重在守住成果与生活质量平衡。',
    ];

    const luckCycles = this.buildLuckCycles(
      birthYear,
      birthMonth,
      birthDay,
      gender,
      monthGanZhi,
      dayMaster,
    );
    const annualForecast = this.buildAnnualForecast(dayMaster);
    const resonance = this.buildResonanceNarratives({
      birthYear,
      dayMaster,
      monthTenGod: tenGods.month,
      dominantElement: elementName[dominant] || '土',
      luckCycles,
      annualForecast,
    });
    const relationship = `${relationshipBase}\n${resonance.relationship}`;
    const career = `${careerBase}\n${resonance.career}`;
    const wealth = `${wealthBase}\n${resonance.wealth}`;

    const yearlyTips = [
      '上半年适合铺垫资源、建立关系，不宜过早定最终结论。',
      '中段适合推进关键项目，但要避免同时开启过多战线。',
      '下半年更适合收敛与复盘，把有效动作沉淀成可复制流程。',
      ...resonance.tips,
    ];

    return {
      corePattern,
      relationship,
      career,
      wealth,
      health,
      decadeRhythm,
      luckCycles,
      annualForecast,
      yearlyTips,
      disclaimer:
        '本解读用于自我观察与决策参考，不替代医疗、法律或投资等专业意见。把它当作“看见自己”的镜子，会比当作绝对预言更有价值。',
    };
  }

  private buildResonanceNarratives(input: {
    birthYear: number;
    dayMaster: string;
    monthTenGod: string;
    dominantElement: string;
    luckCycles: BaziChart['detailedReading']['luckCycles'];
    annualForecast: BaziChart['detailedReading']['annualForecast'];
  }): { relationship: string; career: string; wealth: string; tips: string[] } {
    const currentCycle = this.getCurrentLuckCycle(input.birthYear, input.luckCycles);
    const nextYear = input.annualForecast[0];
    const seed = `${input.dayMaster}|${input.monthTenGod}|${currentCycle?.ganZhi || 'none'}|${nextYear?.ganZhi || 'none'}`;

    const relationTemplates: Record<string, string[]> = {
      正官: [
        '你在关系里往往会先考虑责任和长期性，多半会被“稳定可靠”的人吸引。',
        '你更容易在确定关系后投入更深，所以前期会显得谨慎但并不冷淡。',
      ],
      七杀: [
        '你在情感里通常反应快、判断快，容易先扛住局面，再慢慢处理自己的感受。',
        '当关系节奏过快时，你多半会出现“想控制局面”的倾向，记得给彼此留缓冲。',
      ],
      偏印: [
        '你对关系细节的感知很灵，多半会先在心里推演，再决定要不要表达。',
        '你容易被“能听懂你弦外之音”的人打动，表面平静但内在很深。',
      ],
      default: [
        '你在关系中通常先看安全感再看热度，这种慢热反而更利于长期。',
        '你常常嘴上不说，心里却很在意细节，若能提前表达会少很多误会。',
      ],
    };

    const careerTemplates: Record<string, string[]> = {
      正财: [
        '这类盘在事业上往往是“慢就是快”，你会通过流程化把结果做稳。',
        '你适合把可复用的方法沉淀下来，后面会明显感到效率被放大。',
      ],
      偏财: [
        '你的机会感通常比周围人更早一步，尤其在跨界合作上容易先看到窗口。',
        '这几年你多半会遇到“副线转主线”的机会，前提是先做好风险边界。',
      ],
      伤官: [
        '你在旧框架里会觉得施展不开，一旦允许自己迭代打法，产出会明显上升。',
        '你通常不怕做难题，怕的是低质量重复，所以更适合有创新空间的位置。',
      ],
      default: [
        '你的职业推进常见“前慢后快”的节奏，基础打稳后会进入连续兑现期。',
        '你在关键节点多半靠长期积累取胜，而不是靠一两次短线冲刺。',
      ],
    };

    const wealthTemplates: Record<string, string[]> = {
      正财: [
        '你的财务曲线通常是稳步抬升型，适合先做现金流防线再追求弹性收益。',
        '当你按节奏执行预算时，财富感受会比实际数字更先变稳。',
      ],
      偏财: [
        '你在资源流动和外部机会里更容易看到钱的路径，但也要避免情绪化加码。',
        '你多半会在“人脉+信息差”里获得增量，关键是先守住回撤线。',
      ],
      劫财: [
        '你对机会反应快，容易出现“看准就上”的倾向，先设止损会更安心。',
        '你在合作型收益上通常有亮点，但规则写清楚才能守住成果。',
      ],
      default: [
        '你的财富更像“结构优化”而非一夜爆发，耐心会成为你的复利。',
        '当你把消费与投资拆分管理后，通常会更快看到积累感。',
      ],
    };

    const relation = this.pickTemplateBySeed(
      relationTemplates[input.monthTenGod] || relationTemplates.default,
      `${seed}|rel`,
    );
    const career = this.pickTemplateBySeed(
      careerTemplates[input.monthTenGod] || careerTemplates.default,
      `${seed}|car`,
    );
    const wealth = this.pickTemplateBySeed(
      wealthTemplates[input.monthTenGod] || wealthTemplates.default,
      `${seed}|wel`,
    );

    const cycleAnchor = currentCycle
      ? `当前大运落在${currentCycle.ageRange}（${currentCycle.ganZhi}），你现在处在这步运的${currentCycle.phaseLabel}，这十年主线是${currentCycle.focus}。`
      : '当前大运主线以稳步推进为宜。';
    const annualAnchor = nextYear
      ? `${nextYear.year}年为${nextYear.ganZhi}流年，对你而言更偏向“${nextYear.tenGod}”主题：${nextYear.hint}`
      : '近年流年建议先稳后进，避免多线分散。';

    return {
      relationship: `${relation} ${cycleAnchor}`,
      career: `${career} ${annualAnchor}`,
      wealth: `${wealth} ${cycleAnchor}`,
      tips: [
        `如果你最近反复想起同一件事，多半是当前运势在提醒你先处理“${input.monthTenGod}”主题。`,
        `你命盘里${input.dominantElement}性主导，这几年通常更适合“先稳住节奏，再放大结果”。`,
      ],
    };
  }

  private getCurrentLuckCycle(
    birthYear: number,
    luckCycles: BaziChart['detailedReading']['luckCycles'],
  ): { ageRange: string; ganZhi: string; focus: string; phaseLabel: '前半运' | '后半运' } | null {
    if (!luckCycles?.cycles?.length) return null;
    const currentYear = new Date().getFullYear();
    const approxAge = Math.max(0, currentYear - birthYear);
    for (const cycle of luckCycles.cycles) {
      const [start, end] = cycle.ageRange.replace('岁', '').split('-').map((n) => Number(n));
      if (Number.isFinite(start) && Number.isFinite(end) && approxAge >= start && approxAge <= end) {
        const mid = start + Math.floor((end - start + 1) / 2);
        return {
          ...cycle,
          phaseLabel: approxAge <= mid ? '前半运' : '后半运',
        };
      }
    }
    const fallback = luckCycles.cycles[0];
    return fallback ? { ...fallback, phaseLabel: '前半运' } : null;
  }

  private pickTemplateBySeed(list: string[], seed: string): string {
    if (!list.length) return '';
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    return list[hash % list.length];
  }

  private buildLuckCycles(
    birthYear: number,
    _birthMonth: number,
    birthDay: number,
    gender: 'male' | 'female',
    monthGanZhi: string,
    dayMaster: string,
  ): BaziChart['detailedReading']['luckCycles'] {
    const yearStem = this.calculateYearGanZhi(birthYear).charAt(0);
    const yangStems = ['甲', '丙', '戊', '庚', '壬'];
    const isYangYear = yangStems.includes(yearStem);
    const direction: 'forward' | 'backward' =
      (isYangYear && gender === 'male') || (!isYangYear && gender === 'female') ? 'forward' : 'backward';

    const daysToBoundary = direction === 'forward' ? Math.max(1, 30 - birthDay) : Math.max(1, birthDay);
    const startAge = Math.max(2, Math.min(9, Math.round(daysToBoundary / 3)));

    const cycles: Array<{ ageRange: string; ganZhi: string; focus: string }> = [];
    const monthIdx = this.getGanZhiIndex(monthGanZhi);
    for (let i = 0; i < 8; i++) {
      const idx = direction === 'forward' ? monthIdx + i + 1 : monthIdx - i - 1;
      const ganZhi = this.getGanZhiByIndex(idx);
      const start = startAge + i * 10;
      const end = start + 9;
      const tenGod = this.getTenGod(dayMaster, ganZhi.charAt(0));
      cycles.push({
        ageRange: `${start}-${end}岁`,
        ganZhi,
        focus: `${tenGod}主线：${this.getLuckFocusByTenGod(tenGod)}`,
      });
    }

    return { startAge, direction, cycles };
  }

  private buildAnnualForecast(dayMaster: string): BaziChart['detailedReading']['annualForecast'] {
    const currentYear = new Date().getFullYear();
    const list: Array<{
      year: number;
      ganZhi: string;
      tenGod: string;
      hint: string;
      favorable: string;
      caution: string;
      windowMonths: string[];
    }> = [];
    for (let y = currentYear; y < currentYear + 5; y++) {
      const ganZhi = this.calculateYearGanZhi(y);
      const tenGod = this.getTenGod(dayMaster, ganZhi.charAt(0));
      list.push({
        year: y,
        ganZhi,
        tenGod,
        hint: this.getAnnualHintByTenGod(tenGod),
        favorable: this.getAnnualFavorableByTenGod(tenGod),
        caution: this.getAnnualCautionByTenGod(tenGod),
        windowMonths: this.getAnnualWindowMonthsByTenGod(tenGod),
      });
    }
    return list;
  }

  private getLuckFocusByTenGod(tenGod: string): string {
    const map: Record<string, string> = {
      比肩: '自我定位与独立性强化',
      劫财: '竞争与资源整合能力提升',
      食神: '表达输出、创造与口碑累积',
      伤官: '突破旧框架与能力重塑',
      正印: '学习进修与稳定积累',
      偏印: '研究洞察与策略迭代',
      正财: '稳健财务与长期资产布局',
      偏财: '机会拓展与副业增长',
      正官: '职业秩序与责任升级',
      七杀: '高压挑战与决策升级',
      日主: '回归内核，稳住主线',
    };
    return map[tenGod] || '稳中求进，保持节奏';
  }

  private getAnnualHintByTenGod(tenGod: string): string {
    const map: Record<string, string> = {
      比肩: '适合明确边界与个人主线，避免分散投入。',
      劫财: '机会变多但竞争也强，先做筛选再投入。',
      食神: '适合输出作品与内容，利于口碑扩散。',
      伤官: '适合创新和转型，但沟通要留余地。',
      正印: '利学习考证与系统升级，先稳后快。',
      偏印: '适合研究深耕，避免闭门内耗。',
      正财: '利稳定现金流与资产管理，不宜激进。',
      偏财: '利副业与外部合作，注意风险控制。',
      正官: '职业责任提升，适合规范化推进。',
      七杀: '挑战加大，重在抗压与果断。',
      日主: '回归自我节奏，先修复再扩张。',
    };
    return map[tenGod] || '保持稳定节奏，循序推进。';
  }

  private getAnnualFavorableByTenGod(tenGod: string): string {
    const map: Record<string, string> = {
      比肩: '宜聚焦个人主线，强化边界与执行。',
      劫财: '宜拓圈协同，做资源重组与抢位布局。',
      食神: '宜输出内容和作品，积累口碑势能。',
      伤官: '宜升级打法与创新突破，打穿关键瓶颈。',
      正印: '宜学习考证与体系建设，先稳后快。',
      偏印: '宜研究深耕与策略迭代，沉淀方法论。',
      正财: '宜现金流治理与稳健配置，做长期积累。',
      偏财: '宜拓展副线与外部合作，先小单验证。',
      正官: '宜推进职级责任与规则化管理。',
      七杀: '宜攻坚重点项目，拿阶段性结果。',
      日主: '宜修复状态、统一主轴、减少内耗。',
    };
    return map[tenGod] || '宜稳步推进，保持节奏。';
  }

  private getAnnualCautionByTenGod(tenGod: string): string {
    const map: Record<string, string> = {
      比肩: '忌硬碰硬，避免关系拉扯升级。',
      劫财: '忌冲动投入与人情透支，先立底线。',
      食神: '忌沉迷舒适区，避免慢性拖延。',
      伤官: '忌表达过猛，重要沟通留余地。',
      正印: '忌过度求稳错失窗口期。',
      偏印: '忌闭门推演不落地，防止内耗。',
      正财: '忌激进加杠杆与短线追涨。',
      偏财: '忌频繁换方向，避免节奏失控。',
      正官: '忌完美主义过载，防止压力透支。',
      七杀: '忌长期高压硬扛，注意恢复周期。',
      日主: '忌多线并行分散，先做减法再扩张。',
    };
    return map[tenGod] || '忌节奏过满，避免分散战线。';
  }

  private getAnnualWindowMonthsByTenGod(tenGod: string): string[] {
    const map: Record<string, string[]> = {
      比肩: ['2-3月', '9-10月'],
      劫财: ['3-4月', '8-9月'],
      食神: ['4-5月', '10-11月'],
      伤官: ['5-6月', '11-12月'],
      正印: ['1-2月', '7-8月'],
      偏印: ['2-3月', '6-7月'],
      正财: ['3-4月', '9-10月'],
      偏财: ['4-5月', '10-11月'],
      正官: ['1-2月', '8-9月'],
      七杀: ['2-3月', '7-8月'],
      日主: ['1月', '6月'],
    };
    return map[tenGod] || ['3-4月', '9-10月'];
  }

  private getGanZhiIndex(ganZhi: string): number {
    for (let i = 0; i < 60; i++) {
      const g = this.gan[i % 10];
      const z = this.zhi[i % 12];
      if (`${g}${z}` === ganZhi) return i;
    }
    return 0;
  }

  private getGanZhiByIndex(index: number): string {
    const safe = ((index % 60) + 60) % 60;
    return `${this.gan[safe % 10]}${this.zhi[safe % 12]}`;
  }

  private async enhanceDetailedReadingWithLLM(input: {
    userId: string;
    birthDate: string;
    birthTime: string;
    resolvedSolarDate: string;
    correctedTime: { hour: number; minute: number };
    birthLongitude?: number;
    timezone: string;
    yearGanZhi: string;
    monthGanZhi: string;
    dayGanZhi: string;
    hourGanZhi: string;
    dayMaster: string;
    tenGods: BaziChart['tenGods'];
    wuxingStrength: Record<string, number>;
    baseDetailedReading: BaziChart['detailedReading'];
    membership: MembershipTier;
  }): Promise<BaziChart['detailedReading']> {
    const enableLLM = process.env.BAZI_LLM_ENHANCE === 'true';
    const apiKey = process.env.BAZI_LLM_API_KEY || process.env.DEEPSEEK_API_KEY;
    if (!enableLLM || !apiKey) {
      return this.applyMembershipLayer(input.baseDetailedReading, input.membership);
    }

    const cacheKey = [
      input.userId,
      input.resolvedSolarDate,
      input.birthTime,
      input.correctedTime.hour,
      input.correctedTime.minute,
      input.yearGanZhi,
      input.monthGanZhi,
      input.dayGanZhi,
      input.hourGanZhi,
    ].join('|');
    const now = Date.now();
    const cached = this.llmCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return this.applyMembershipLayer(this.mergeLuckPatch(input.baseDetailedReading, cached.patch), input.membership);
    }

    try {
      const payload = {
        birthInput: {
          birthDate: input.birthDate,
          birthTime: input.birthTime,
          resolvedSolarDate: input.resolvedSolarDate,
          trueSolarTime: `${String(input.correctedTime.hour).padStart(2, '0')}:${String(input.correctedTime.minute).padStart(2, '0')}`,
          birthLongitude: input.birthLongitude,
          timezone: input.timezone,
        },
        pillars: {
          yearGanZhi: input.yearGanZhi,
          monthGanZhi: input.monthGanZhi,
          dayGanZhi: input.dayGanZhi,
          hourGanZhi: input.hourGanZhi,
          dayMaster: input.dayMaster,
          tenGods: input.tenGods,
          wuxingStrength: input.wuxingStrength,
        },
        luck: {
          luckCycles: input.baseDetailedReading.luckCycles,
          annualForecast: input.baseDetailedReading.annualForecast,
        },
      };

      const apiUrl = process.env.BAZI_LLM_API_URL || process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions';
      const model = process.env.BAZI_LLM_MODEL || process.env.DEEPSEEK_MODEL || 'deepseek-chat';
      const response = await axios.post(
        apiUrl,
        {
          model,
          temperature: 0.3,
          max_tokens: 1200,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                '你是资深命理老师。必须严格基于输入排盘结果写大运流年，不可改动干支与起运信息。' +
                '输出JSON，字段可包含：corePattern,relationship,career,wealth,health,decadeRhythm(string[]),yearlyTips(string[])。' +
                '文风偏口语老师傅、温和、不制造焦虑；每条建议具体可执行。' +
                '表达策略使用“硬锚点+弹性缓冲”：每段先给1个可验证锚点（如起运年龄/十神主线/某个干支），再给1个概率表达（如通常、多半、往往、这几年更容易）。',
            },
            {
              role: 'user',
              content: JSON.stringify(payload),
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        },
      );

      const content = response.data?.choices?.[0]?.message?.content;
      if (!content) return input.baseDetailedReading;
      const parsed = JSON.parse(content) as LuckReadingPatch;
      const patch = this.normalizeLuckPatch(parsed);
      const styledPatch = this.applyPrecisionAmbiguityStyle(patch);
      const merged = this.mergeLuckPatch(input.baseDetailedReading, styledPatch);
      this.llmCache.set(cacheKey, { expiresAt: now + 6 * 60 * 60 * 1000, patch: styledPatch });
      return this.applyMembershipLayer(merged, input.membership);
    } catch (error) {
      this.logger.warn(`八字LLM增强失败，使用规则结果回退: ${(error as Error).message}`);
      return this.applyMembershipLayer(input.baseDetailedReading, input.membership);
    }
  }

  private applyMembershipLayer(
    reading: BaziChart['detailedReading'],
    membership: MembershipTier,
  ): BaziChart['detailedReading'] {
    if (membership === 'premium' || membership === 'vip') {
      return {
        ...reading,
        paywallHint: undefined,
        annualForecast: reading.annualForecast.map((item) => ({
          ...item,
          masterCommentary: this.getMasterCommentary(item, membership),
        })),
      };
    }

    return {
      ...reading,
      paywallHint: '升级会员可解锁每年「老师傅点评」与完整五年细化建议。',
      annualForecast: reading.annualForecast.map((item, idx) => ({
        ...item,
        favorable: idx <= 1 ? item.favorable : '升级会员解锁该年详细「宜」策略',
        caution: idx <= 1 ? item.caution : '升级会员解锁该年详细「忌」提醒',
        windowMonths: idx <= 1 ? item.windowMonths : ['升级会员解锁关键窗口月'],
        masterCommentary: undefined,
      })),
    };
  }

  private getMasterCommentary(
    item: BaziChart['detailedReading']['annualForecast'][number],
    membership: MembershipTier,
  ): string {
    const stylePrefix = membership === 'vip' ? '老师傅批注（深度版）' : '老师傅批注';
    const toneMap: Record<string, string> = {
      比肩: '这一年你更该把边界立稳，先守住主线，再谈扩张。',
      劫财: '机会和竞争会同时上来，先做筛选，后做投入，别贪多。',
      食神: '输出就是你的运，作品和表达会带来后续机会。',
      伤官: '想法很活，但说话做事要留余地，锋芒收一点更顺。',
      正印: '先把基本功和体系打牢，后面自然有位置给你。',
      偏印: '适合沉下去做深度，别把时间耗在反复犹豫上。',
      正财: '重心在稳财，不求一口吃成，求持续复利。',
      偏财: '有外部机会，但要先设边界，见好就收比硬扛好。',
      正官: '责任会加码，越规范越能出结果。',
      七杀: '压力不小，但你扛得住，记得留恢复窗口。',
      日主: '这一年先顾好自己节奏，稳住了才有余力发力。',
    };
    return `${stylePrefix}：${toneMap[item.tenGod] || '先稳后进，顺势而为。'}`;
  }

  private normalizeLuckPatch(raw: LuckReadingPatch): LuckReadingPatch {
    const toList = (v: unknown, max: number) =>
      Array.isArray(v)
        ? v.map((i) => String(i || '').trim()).filter(Boolean).slice(0, max)
        : undefined;
    const safeText = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
    return {
      corePattern: safeText(raw.corePattern),
      relationship: safeText(raw.relationship),
      career: safeText(raw.career),
      wealth: safeText(raw.wealth),
      health: safeText(raw.health),
      decadeRhythm: toList(raw.decadeRhythm, 8),
      yearlyTips: toList(raw.yearlyTips, 8),
    };
  }

  private mergeLuckPatch(
    base: BaziChart['detailedReading'],
    patch: LuckReadingPatch,
  ): BaziChart['detailedReading'] {
    return {
      ...base,
      corePattern: patch.corePattern || base.corePattern,
      relationship: patch.relationship || base.relationship,
      career: patch.career || base.career,
      wealth: patch.wealth || base.wealth,
      health: patch.health || base.health,
      decadeRhythm: patch.decadeRhythm?.length ? patch.decadeRhythm : base.decadeRhythm,
      yearlyTips: patch.yearlyTips?.length ? patch.yearlyTips : base.yearlyTips,
    };
  }

  private applyPrecisionAmbiguityStyle(patch: LuckReadingPatch): LuckReadingPatch {
    const enabled = process.env.BAZI_AMBIGUITY_STYLE !== 'false';
    if (!enabled) return patch;

    const softened: LuckReadingPatch = { ...patch };
    if (typeof softened.corePattern === 'string') softened.corePattern = this.softAmbiguousSentence(softened.corePattern);
    if (typeof softened.relationship === 'string') softened.relationship = this.softAmbiguousSentence(softened.relationship);
    if (typeof softened.career === 'string') softened.career = this.softAmbiguousSentence(softened.career);
    if (typeof softened.wealth === 'string') softened.wealth = this.softAmbiguousSentence(softened.wealth);
    if (typeof softened.health === 'string') softened.health = this.softAmbiguousSentence(softened.health);
    if (softened.decadeRhythm?.length) {
      softened.decadeRhythm = softened.decadeRhythm.map((s) => this.softAmbiguousSentence(s));
    }
    if (softened.yearlyTips?.length) {
      softened.yearlyTips = softened.yearlyTips.map((s) => this.softAmbiguousSentence(s));
    }
    return softened;
  }

  private softAmbiguousSentence(input: string): string {
    const sentence = input.trim();
    if (!sentence) return sentence;

    // 已含概率词则不重复加工，避免过度“玄学腔”
    if (/(通常|往往|多半|大概率|这几年更容易|偏向|可能)/.test(sentence)) {
      return sentence;
    }

    const anchors = ['起运', '岁', '年', '十神', '干支', '大运', '流年', '日主'];
    const hasAnchor = anchors.some((k) => sentence.includes(k));
    if (hasAnchor) {
      return `${sentence}（这类信号通常在同类盘里会反复出现）。`;
    }

    return `从你这类盘面看，${sentence.replace(/^[，。；：\s]+/, '')}`;
  }
}
