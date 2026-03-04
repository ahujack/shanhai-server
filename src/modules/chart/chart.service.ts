import { Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';

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
}

@Injectable()
export class ChartService {
  private charts: Map<string, BaziChart> = new Map();
  
  // 天干
  private gan = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  // 地支
  private zhi = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  
  async generateChart(
    userId: string, 
    birthDate: string, 
    birthTime: string, 
    gender: 'male' | 'female'
  ): Promise<BaziChart> {
    // 解析日期
    const date = new Date(birthDate);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    const [hour, minute] = birthTime.split(':').map(Number);
    
    // 计算八字
    const yearGZ = this.calculateYearGanZhi(year);
    const monthGZ = this.calculateMonthGanZhi(year, month);
    const dayGZ = this.calculateDayGanZhi(year, month, day);
    const hourGZ = this.calculateHourGanZhi(dayGZ, hour);
    
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
      sun: this.getSunSign(month, day),
      moon: this.getMoonSign(month),
      wuxingStrength: wuxingStrength as { wood: number; fire: number; earth: number; metal: number; water: number },
      personalityTraits,
      fortuneSummary,
      suggestions,
    };

    this.charts.set(userId, chart);
    return chart;
  }
  
  findOne(userId: string): BaziChart | null {
    return this.charts.get(userId) ?? null;
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
}
