import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

// ========== 笔迹心理学分析 ==========
export interface HandwritingAnalysis {
  // 力度
  pressure: 'heavy' | 'light' | 'medium';
  pressureInterpretation: string;
  
  // 稳定性
  stability: 'stable' | 'shaky' | 'average';
  stabilityInterpretation: string;
  
  // 结构
  structure: 'compact' | 'loose' | 'balanced';
  structureInterpretation: string;
  
  // 连贯性
  continuity: 'connected' | 'broken' | 'average';
  continuityInterpretation: string;
  
  // 整体风格
  overallStyle: string;
  personalityInsights: string[];
}

// 笔迹特征库
const handwritingPatterns = {
  // 力度分析
  pressure: {
    heavy: {
      description: '笔画力度较重',
      interpretation: '你是一个有较强控制欲和责任感的人。内心有股不轻易妥协的力量，可能对自己和他人都有较高的期望。',
      traits: ['有主见', '意志坚定', '执行力强', '自我要求高'],
    },
    light: {
      description: '笔画力度较轻',
      interpretation: '你可能近期感到有些疲惫，或者性格较为温和、不争强好胜。也有可能是对某些事情还在犹豫不决。',
      traits: ['温和', '善于思考', '内心敏感', '待人友善'],
    },
    medium: {
      description: '笔画力度适中',
      interpretation: '你是一个情绪稳定、为人处世较为均衡的人。能很好地把握分寸，适应能力较强。',
      traits: ['稳重', '靠谱', '懂得变通', '心态平和'],
    },
  },
  
  // 稳定性分析
  stability: {
    stable: {
      description: '字迹工整平稳',
      interpretation: '你目前状态较为稳定，有明确的目标和计划。执行力强，不太容易受到外界干扰。',
      traits: ['有条理', '自律性强', '情绪稳定', '值得信赖'],
    },
    shaky: {
      description: '字迹有些颤抖或歪斜',
      interpretation: '你可能最近感到焦虑、压力较大，或者内心有些不确定的事情。书写时的手部动作反映了你内心的波动。',
      traits: ['内心纠结', '压力较大', '可能失眠', '需要倾诉'],
    },
    average: {
      description: '字迹平稳但有小波动',
      interpretation: '你处于一个调整期，既有稳定的根基，又有变化的可能。这是正常的心理状态。',
      traits: ['心态平衡', '灵活应变', '懂得调适', '有弹性'],
    },
  },
  
  // 结构分析
  structure: {
    compact: {
      description: '字结构紧凑',
      interpretation: '你是一个注重细节、善于规划的人。思想集中，目标明确，但有时候可能过于追求完美或过于谨慎。',
      traits: ['思维缜密', '精打细算', '执行力强', '有时较真'],
    },
    loose: {
      description: '字结构松散',
      interpretation: '你可能最近有些"力不从心"，或者在某个重要决定上感到难以取舍。字的结构松散也暗示着思维可能有些发散。',
      traits: ['创意丰富', '想法多', '有时拖延', '需要聚焦'],
    },
    balanced: {
      description: '结构疏密有致',
      interpretation: '你是一个懂得平衡的人。工作与生活、理想与现实，你都能较好地协调。',
      traits: ['懂得取舍', '成熟稳重', '情商高', '善于协调'],
    },
  },
  
  // 连贯性分析
  continuity: {
    connected: {
      description: '笔画连贯流畅',
      interpretation: '你做事情有较强的连续性和执行力一旦决定就会持续推进，不太会半途而废。',
      traits: ['有恒心', '执行力强', '专注度高', '意志坚定'],
    },
    broken: {
      description: '有断笔或涂改',
      interpretation: '你可能在某些决定上还有所顾虑，或者近期思维有些跳跃。可能需要更多时间来理清思路。',
      traits: ['思维活跃', '考虑周全', '有时纠结', '追求完美'],
    },
    average: {
      description: '连贯性一般',
      interpretation: '你的状态较为正常，既有思考的停顿，也有行动的连续。这是健康的心理状态。',
      traits: ['懂得调节', '灵活应变', '张弛有度', '心态健康'],
    },
  },
};

// ========== 汉字拆解分析 ==========
export interface ZiAnalysis {
  // 基础信息
  zi: string;
  bushou: string;
  bihua: number;
  wuxing: string;
  yinyang: string;
  jixiong: string;
  
  // 易经
  yijing: string;
  guaXiang: string;
  
  // 拆解
  components: string[];        // 部件拆解
  componentMeanings: string[];  // 部件含义
  associativeMeaning: string;   // 联想含义
}

// 汉字拆解库
const ziComponents: Record<string, { parts: string[]; meanings: string[]; association: string }> = {
  '安': { parts: ['宀', '女'], meanings: ['屋顶/家', '女性/柔'], association: '家中有女为安，古时认为女子在家为安' },
  '定': { parts: ['宀', '疋'], meanings: ['屋顶/家', '脚/止'], association: '足不出户为定，有安止之意' },
  '想': { parts: ['木', '目', '心'], meanings: ['树木/希望', '眼睛/看法', '心思'], association: '眼中所见，心中所思' },
  '困': { parts: ['囗', '木'], meanings: ['包围', '树木'], association: '木在口中，无法伸展' },
  '心': { parts: ['心'], meanings: ['心脏/核心'], association: '用心去感受' },
  '情': { parts: ['忄', '青'], meanings: ['心/情感', '青春/生机'], association: '心上有青，情感之生' },
  '爱': { parts: ['爪', '冖', '心', '夂'], meanings: ['抓取', '覆盖', '心', '脚'], association: '用心抓取，脚行远方' },
  '福': { parts: ['示', '一口田'], meanings: ['祭祀', '一口田/产业'], association: '有田有祀为福' },
  '财': { parts: ['贝', '才'], meanings: ['钱贝', '才能'], association: '贝为钱，有才方能生财' },
  '运': { parts: ['辶', '云'], meanings: ['行走', '云彩/变化'], association: '云动为运，事物在变' },
  '事': { parts: ['亅', '口', '一'], meanings: ['钩', '人口', '一横'], association: '以口行事，一以贯之' },
  '道': { parts: ['辶', '首'], meanings: ['行走', '头脑/开始'], association: '用头脑思考后行走' },
  '梦': { parts: ['夕', '冖', '木'], meanings: ['夜晚', '覆盖', '树木'], association: '夜间树下之想' },
  '命': { parts: ['人', '叩'], meanings: ['人', '叩首'], association: '人叩首为命，天命所归' },
  '缘': { parts: ['糸', '豕'], meanings: ['丝线', '猪/缘分'], association: '丝线相连，缘分所系' },
  '吉': { parts: ['士', '口'], meanings: ['士人', '口'], association: '士人口中所言为吉' },
  '凶': { parts: ['凵', '乛'], meanings: ['陷阱', '覆盖'], association: '陷阱之中为凶' },
  '难': { parts: ['又', '隹'], meanings: ['手', '鸟'], association: '又一只鸟，难以捕捉' },
};

// ========== 冷读术话术库 ==========
const coldReadingPhrases = {
  // 关于分离/纠结
  separation: [
    '从你写的字来看，部件之间似乎有些分离，这往往暗示你最近可能感到有些"力不从心"，',
    '你的字结构上有种"若即若离"的感觉，或许在某个重要决定上你在犹豫？',
    '笔画之间不够紧密，可能说明你心里装着一些事情，难以完全放下。',
  ],
  
  // 关于压力/焦虑
  pressure: [
    '看你写字的力度，能感受到你内心的那股"劲"，可能是压力，也可能是决心。',
    '你的字写得相当用力，这代表你有很强的自我期许，但也要注意别太逼迫自己。',
    '笔画比较重，是不是有什么事情让你放不下？',
  ],
  
  // 关于迷茫
  confusion: [
    '你的字整体看起来有些"游移"，好像在寻找某个方向，这可能是你现在的状态吗？',
    '字的结构不太确定，可能代表你对某件事情还在观望。',
    '看你的字，有一种"不知归处"的感觉，最近是否有些迷茫？',
  ],
  
  // 关于情感
  emotion: [
    '从字里能感受到你是个重感情的人，',
    '你的字中带有一种细腻，这说明你很重视身边的人和事。',
    '看你的用笔，能感受到你内心的柔软部分。',
  ],
  
  // 关于事业
  career: [
    '你的字很有"格局"，说明你是有想法的人，',
    '从字的结构来看，你有统筹规划的能力，',
    '你的字中间宫位写得比较满，这是个擅长运作的格局。',
  ],
};

// ========== 主接口 ==========
export interface ZiResult {
  // 手写分析
  handwriting: HandwritingAnalysis;
  
  // 汉字分析
  zi: ZiAnalysis;
  
  // 综合解读
  interpretation: {
    overall: string;
    career: string;
    love: string;
    wealth: string;
    health: string;
    advice: string[];
  };
  
  // 冷读话术
  coldReadings: string[];
  
  // 后续问题（用于反问）
  followUpQuestions: string[];
  
  metadata: {
    method: '测字有术 - AI笔迹与语义分析';
    generatedAt: string;
  };
}

@Injectable()
export class ZiService {
  private logger = new Logger(ZiService.name);
  
  /**
   * 测字主入口
   * @param zi 要测的字
   * @param handwritingData 手写特征数据（可选）
   */
  async analyze(zi: string, handwritingData?: Partial<HandwritingAnalysis>): Promise<ZiResult> {
    const char = zi.charAt(0);
    
    // 1. 笔迹分析
    const handwriting = this.analyzeHandwriting(handwritingData);
    
    // 2. 汉字拆解分析
    const ziAnalysis = this.analyzeZi(char);
    
    // 3. 生成冷读话术
    const coldReadings = this.generateColdReadings(handwriting, ziAnalysis);
    
    // 4. 生成综合解读
    const interpretation = this.generateInterpretation(handwriting, ziAnalysis);
    
    // 5. 生成后续问题
    const followUpQuestions = this.generateFollowUpQuestions(ziAnalysis);
    
    // 6. 尝试使用 LLM 增强（如果可用）
    try {
      const llmEnhancement = await this.getLLMEnhancement(char, handwriting, ziAnalysis);
      if (llmEnhancement) {
        interpretation.overall = llmEnhancement.overall || interpretation.overall;
        if (llmEnhancement.advice) {
          interpretation.advice = [...interpretation.advice, ...llmEnhancement.advice].slice(0, 5);
        }
      }
    } catch (error) {
      this.logger.warn('LLM增强失败，使用本地分析', error);
    }
    
    return {
      handwriting,
      zi: ziAnalysis,
      interpretation,
      coldReadings,
      followUpQuestions,
      metadata: {
        method: '测字有术 - AI笔迹与语义分析',
        generatedAt: new Date().toISOString(),
      },
    };
  }
  
  /**
   * 分析手写特征
   */
  private analyzeHandwriting(data?: Partial<HandwritingAnalysis>): HandwritingAnalysis {
    // 如果有真实的手写数据，使用它
    if (data) {
      return {
        pressure: data.pressure || 'medium',
        pressureInterpretation: handwritingPatterns.pressure[data.pressure || 'medium'].interpretation,
        stability: data.stability || 'average',
        stabilityInterpretation: handwritingPatterns.stability[data.stability || 'average'].interpretation,
        structure: data.structure || 'balanced',
        structureInterpretation: handwritingPatterns.structure[data.structure || 'balanced'].interpretation,
        continuity: data.continuity || 'average',
        continuityInterpretation: handwritingPatterns.continuity[data.continuity || 'average'].interpretation,
        overallStyle: '根据手写数据分析',
        personalityInsights: [
          ...(handwritingPatterns.pressure[data.pressure || 'medium'].traits || []),
          ...(handwritingPatterns.stability[data.stability || 'average'].traits || []),
        ].slice(0, 4),
      };
    }
    
    // 否则使用时间戳模拟随机但一致的分析
    const now = Date.now();
    const pressureKeys = Object.keys(handwritingPatterns.pressure) as Array<'heavy' | 'light' | 'medium'>;
    const stabilityKeys = Object.keys(handwritingPatterns.stability) as Array<'stable' | 'shaky' | 'average'>;
    const structureKeys = Object.keys(handwritingPatterns.structure) as Array<'compact' | 'loose' | 'balanced'>;
    const continuityKeys = Object.keys(handwritingPatterns.continuity) as Array<'connected' | 'broken' | 'average'>;
    
    const pressure = pressureKeys[now % 3];
    const stability = stabilityKeys[(now >> 4) % 3];
    const structure = structureKeys[(now >> 8) % 3];
    const continuity = continuityKeys[(now >> 12) % 3];
    
    return {
      pressure,
      pressureInterpretation: handwritingPatterns.pressure[pressure].interpretation,
      stability,
      stabilityInterpretation: handwritingPatterns.stability[stability].interpretation,
      structure,
      structureInterpretation: handwritingPatterns.structure[structure].interpretation,
      continuity,
      continuityInterpretation: handwritingPatterns.continuity[continuity].interpretation,
      overallStyle: 'AI模拟笔迹分析（建议接入真实手写识别）',
      personalityInsights: [
        ...handwritingPatterns.pressure[pressure].traits,
        ...handwritingPatterns.stability[stability].traits,
      ].slice(0, 4),
    };
  }
  
  /**
   * 分析汉字结构
   */
  private analyzeZi(zi: string): ZiAnalysis {
    const char = zi.charAt(0);
    
    // 检查是否有预设数据
    const preset = ziComponents[char];
    if (preset) {
      return {
        zi: char,
        bushou: this.getBushou(char),
        bihua: this.countBihua(char),
        wuxing: this.inferWuxing(char),
        yinyang: this.countBihua(char) % 2 === 0 ? '阴' : '阳',
        jixiong: this.inferJixiong(char),
        yijing: this.getYijing(char),
        guaXiang: this.getGuaXiang(char),
        components: preset.parts,
        componentMeanings: preset.meanings,
        associativeMeaning: preset.association,
      };
    }
    
    // 自动分析
    return {
      zi: char,
      bushou: this.getBushou(char),
      bihua: this.countBihua(char),
      wuxing: this.inferWuxing(char),
      yinyang: this.countBihua(char) % 2 === 0 ? '阴' : '阳',
      jixiong: this.inferJixiong(char),
      yijing: this.getYijing(char),
      guaXiang: this.getGuaXiang(char),
      components: this.breakDown(char),
      componentMeanings: this.getComponentMeanings(char),
      associativeMeaning: `此字需细加品味，可从字形、字义、字音多角度联想。`,
    };
  }
  
  /**
   * 生成冷读话术
   */
  private generateColdReadings(handwriting: HandwritingAnalysis, zi: ZiAnalysis): string[] {
    const results: string[] = [];
    const now = Date.now();
    
    // 根据结构选择分离类话术
    if (handwriting.structure === 'loose') {
      results.push(coldReadingPhrases.separation[now % 3]);
    }
    
    // 根据力度选择压力类话术
    if (handwriting.pressure === 'heavy') {
      results.push(coldReadingPhrases.pressure[now % 3]);
    }
    
    // 根据稳定性选择迷茫类话术
    if (handwriting.stability === 'shaky') {
      results.push(coldReadingPhrases.confusion[now % 3]);
    }
    
    // 根据五行添加对应话术
    if (zi.wuxing === '火') {
      results.push('你的字带有一种"热烈"的感觉，可能是行动力很强的人。');
    } else if (zi.wuxing === '水') {
      results.push('你的字给我一种"流动"的感觉，你可能是个善于变通的人。');
    } else if (zi.wuxing === '木') {
      results.push('你的字结构中有"生长"之势，看来你是比较有活力的人。');
    } else if (zi.wuxing === '土') {
      results.push('你的字给人"稳重"的感觉，你可能是个值得信赖的人。');
    } else if (zi.wuxing === '金') {
      results.push('你的字棱角分明，看来是个有原则、有决断力的人。');
    }
    
    // 确保有3条话术
    while (results.length < 3) {
      results.push(coldReadingPhrases.emotion[results.length % 3]);
    }
    
    return results.slice(0, 3);
  }
  
  /**
   * 生成综合解读
   */
  private generateInterpretation(handwriting: HandwritingAnalysis, zi: ZiAnalysis): ZiResult['interpretation'] {
    const advice: string[] = [];
    
    // 基于手写特征的建议
    if (handwriting.stability === 'shaky') {
      advice.push('建议：给自己一些时间深呼吸，让心静下来');
    }
    if (handwriting.structure === 'loose') {
      advice.push('建议：可以尝试列一个清单，把想法写下来');
    }
    if (handwriting.pressure === 'heavy') {
      advice.push('建议：适当放松对自己的要求，接纳不完美');
    }
    
    // 基于汉字的建议
    if (zi.jixiong === '凶') {
      advice.push('此字带有挑战，但危机也是转机');
      advice.push('建议：保持低调，谨慎行事');
    } else if (zi.jixiong === '吉') {
      advice.push('此字寓意不错，把握当下机遇');
      advice.push('建议：乘胜追击，广结善缘');
    }
    
    // 基于五行的建议
    const wuxingAdvice: Record<string, string> = {
      '木': '宜保持活力，但注意不要过度劳累',
      '火': '宜保持热情，但注意控制情绪',
      '土': '宜稳重行事，注意脾胃保养',
      '金': '宜果断决策，注意呼吸系统',
      '水': '宜保持灵活性，注意休息',
    };
    advice.push(wuxingAdvice[zi.wuxing] || '保持良好生活习惯');
    
    return {
      overall: `${handwriting.pressureInterpretation} ${handwriting.structureInterpretation}`,
      career: `从你的字来看，你是个有${handwriting.personalityInsights[0] || '想法'}的人，${zi.wuxing}性较强，适合 ${this.getCareerByWuxing(zi.wuxing)} 方向。`,
      love: `你是个重感情的人，${zi.yinyang === '阳' ? '在感情中较为主动' : '内心细腻，需要被理解'}。`,
      wealth: `财运与${zi.wuxing}相关，${zi.jixiong === '吉' ? '正财运不错' : '需稳扎稳打'}。`,
      health: `注意 ${this.getHealthByWuxing(zi.wuxing)}。`,
      advice: advice.slice(0, 4),
    };
  }
  
  /**
   * 生成后续问题（反问）
   */
  private generateFollowUpQuestions(zi: ZiAnalysis): string[] {
    const questions: string[] = [];
    
    // 基于汉字生成问题
    if (zi.components.length > 1) {
      questions.push(`你写的"${zi.zi}"字，中间的"${zi.components[1]}"部分你想表达什么？`);
    }
    
    if (zi.zi === '困') {
      questions.push('你写的这个"困"字，是最近在工作上感到受限吗？');
    } else if (zi.zi === '安') {
      questions.push('对于"安"这个字，你首先想到的是什么？');
    } else if (zi.zi === '情') {
      questions.push('是感情方面有什么困惑吗？');
    } else if (zi.zi === '财') {
      questions.push('是关于财运还是事业？');
    }
    
    // 通用问题
    questions.push('最近是否有特别在意的事情？');
    questions.push('这个字是你随意写的，还是有特别的想法？');
    
    return questions.slice(0, 2);
  }
  
  /**
   * LLM 增强（可选）
   */
  private async getLLMEnhancement(
    zi: string, 
    handwriting: HandwritingAnalysis, 
    ziAnalysis: ZiAnalysis
  ): Promise<{ overall?: string; advice?: string[] } | null> {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return null;
    
    try {
      const response = await axios.post(
        process.env.DEEPSEEK_API_URL ?? 'https://api.deepseek.com/chat/completions',
        {
          model: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
          temperature: 0.7,
          max_tokens: 500,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `你是一位精通《测字有术》的高阶分析师，擅长笔迹心理学、冷读术和易经解读。
请根据以下信息，生成一段有深度的测字解读。要求：
1. 结合笔迹特征和汉字含义
2. 使用冷读术技巧，让解读显得"神准"
3. 给出实用的心理建议
4. 输出JSON格式：{ overall: string, advice: string[] }`,
            },
            {
              role: 'user',
              content: JSON.stringify({
                zi,
                handwriting: {
                  pressure: handwriting.pressure,
                  stability: handwriting.stability,
                  structure: handwriting.structure,
                  traits: handwriting.personalityInsights,
                },
                ziAnalysis: {
                  components: ziAnalysis.components,
                  meanings: ziAnalysis.componentMeanings,
                  wuxing: ziAnalysis.wuxing,
                  jixiong: ziAnalysis.jixiong,
                },
              }),
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );
      
      const content = response.data?.choices?.[0]?.message?.content;
      if (content) {
        return JSON.parse(content);
      }
    } catch (error) {
      this.logger.warn('LLM增强调用失败', error);
    }
    
    return null;
  }
  
  // ========== 辅助方法 ==========
  
  private countBihua(zi: string): number {
    const bihuaMap: Record<string, number> = {
      '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
      '人': 2, '入': 2, '大': 3, '小': 3, '口': 3, '山': 3, '水': 4, '火': 4, '心': 4,
      '木': 4, '金': 8, '土': 3, '王': 4, '天': 4, '地': 6, '日': 4, '月': 4, '目': 5,
    };
    return bihuaMap[zi] || 4;
  }
  
  private getBushou(zi: string): string {
    const map: Record<string, string> = {
      '安': '宀', '定': '宀', '福': '示', '家': '宀', '守': '宀',
      '想': '木', '困': '囗', '林': '木', '森': '木',
      '情': '忄', '性': '忄', '怕': '忄', '恭': '心',
      '爱': '爪', '采': '爪', '爵': '爪',
      '财': '贝', '贵': '贝', '货': '贝',
    };
    return map[zi] || '其他';
  }
  
  private inferWuxing(zi: string): string {
    const bushou = this.getBushou(zi);
    const wuxingMap: Record<string, string> = {
      '木': '木', '艹': '木',
      '火': '火', '灬': '火', '心': '火', '忄': '火',
      '土': '土', '石': '土', '王': '土',
      '金': '金', '钅': '金', '刂': '金', '刀': '金',
      '水': '水', '氵': '水', '雨': '水',
    };
    if (wuxingMap[bushou]) return wuxingMap[bushou];
    
    // 根据笔画数推断
    const bihua = this.countBihua(zi);
    const wx = ['木', '火', '土', '金', '水'];
    return wx[bihua % 5];
  }
  
  private inferJixiong(zi: string): string {
    const jixiongWords = ['福', '禄', '寿', '喜', '财', '吉', '祥', '瑞', '安', '定', '和', '平', '顺', '旺', '兴', '发'];
    if (jixiongWords.some(w => zi.includes(w))) return '吉';
    
    const xiongxingWords = ['凶', '煞', '厄', '劫', '难', '祸', '灾', '病', '死', '亡', '破', '败'];
    if (xiongxingWords.some(w => zi.includes(w))) return '凶';
    
    return '平';
  }
  
  private getYijing(zi: string): string {
    const gua = ['乾', '坤', '屯', '蒙', '需', '讼', '师', '比', '小畜', '履', '泰', '否'];
    return gua[zi.charCodeAt(0) % 12];
  }
  
  private getGuaXiang(zi: string): string {
    const map: Record<string, string> = {
      '乾': '天行健，君子以自强不息', '坤': '地势坤，君子以厚德载物',
      '泰': '天地交泰，万物通顺', '否': '天地不交，闭塞不通',
    };
    return map[zi] || '卦象深奥，需细加体会';
  }
  
  private breakDown(zi: string): string[] {
    // 简单拆解
    if (zi.length > 1) return zi.split('');
    return [zi];
  }
  
  private getComponentMeanings(zi: string): string[] {
    return this.breakDown(zi).map(c => `部件"${c}"`);
  }
  
  private getCareerByWuxing(wuxing: string): string {
    const map: Record<string, string> = {
      '木': '教育、文化、艺术', '火': '互联网、能源、餐饮',
      '土': '房地产、建筑、农业', '金': '金融、法律、机械',
      '水': '物流、旅游、贸易',
    };
    return map[wuxing] || '各行业';
  }
  
  private getHealthByWuxing(wuxing: string): string {
    const map: Record<string, string> = {
      '木': '肝胆', '火': '心脏', '土': '脾胃', '金': '肺', '水': '肾',
    };
    return map[wuxing] || '身体';
  }
}
