import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ORACLE_BONE_SNAPSHOT } from './oracle-bone.snapshot';

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
  lihefa: string[];             // 离合法拆解
  tianziGe: string[];           // 填字格联想
  imageryInference: string;     // 象形投射
  probingQuestion: string;      // 冷读反问
  oracleBone: {
    exists: boolean;
    source: string;
    imageUrls: string[];
    totalImages: number;
    shownImages: number;
    previewLocked: boolean;
    interpretation: string;
    note: string;
  };
}

interface OracleBoneEntry {
  name: string;
  image: string;
}

type MembershipTier = 'free' | 'premium' | 'vip';
type FocusKey = 'career' | 'wealth' | 'love' | 'study' | 'health' | 'relationship' | 'general';

interface FocusProfile {
  key: FocusKey;
  label: string;
  custom?: string;
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
    focusReading?: {
      focus: string;
      summary: string;
      anchors: string[];
      riskSignals: string[];
      actionPlan: string[];
      llmEnhanced?: boolean;
    };
    premiumHint?: string;
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
  private readonly logger = new Logger(ZiService.name);
  private oracleBoneLexicon: Map<string, string[]> | null = null;
  private oracleBoneLexiconLoading: Promise<void> | null = null;
  private oracleBoneLexiconLoadedAt = 0;
  private readonly oracleBoneIndexUrl =
    process.env.ORACLE_BONE_INDEX_URL ||
    'https://raw.githubusercontent.com/Chinese-Traditional-Culture/JiaGuWen/master/index.json';
  private readonly oracleBoneImageBaseUrl =
    process.env.ORACLE_BONE_IMAGE_BASE_URL ||
    'https://raw.githubusercontent.com/Chinese-Traditional-Culture/JiaGuWen/master/i/';
  private readonly oracleBoneCacheMs = 24 * 60 * 60 * 1000;
  
  /**
   * 测字主入口
   * @param zi 要测的字
   * @param handwritingData 手写特征数据（可选）
   */
  async analyze(
    zi: string,
    handwritingData?: Partial<HandwritingAnalysis>,
    membership: MembershipTier = 'free',
    focusAspect?: string,
  ): Promise<ZiResult> {
    try {
      const char = zi.charAt(0);
      const focus = this.normalizeFocusAspect(focusAspect);
      await this.ensureOracleBoneLexicon();
      
      // 1. 笔迹分析
      const handwriting = this.analyzeHandwriting(handwritingData);
      
      // 2. 汉字拆解分析
      const ziAnalysis = this.analyzeZi(char, membership);
      
      // 3. 生成冷读话术
      const coldReadings = this.generateColdReadings(handwriting, ziAnalysis);
      
      // 4. 生成综合解读
      const interpretation = this.generateInterpretation(handwriting, ziAnalysis, focus);
      
      // 5. 生成后续问题
      const followUpQuestions = this.generateFollowUpQuestions(ziAnalysis, focus);
      
      // 6. 尝试使用 LLM 增强（如果可用）
      try {
        const llmEnhancement = await this.getLLMEnhancement(char, handwriting, ziAnalysis, focus);
        if (llmEnhancement) {
          interpretation.overall = llmEnhancement.overall || interpretation.overall;
          interpretation.career = llmEnhancement.career || interpretation.career;
          interpretation.wealth = llmEnhancement.wealth || interpretation.wealth;
          interpretation.love = llmEnhancement.love || interpretation.love;
          interpretation.health = llmEnhancement.health || interpretation.health;
          if (llmEnhancement.advice) {
            interpretation.advice = [...interpretation.advice, ...llmEnhancement.advice].slice(0, 5);
          }
          if (llmEnhancement.focusReading && interpretation.focusReading) {
            interpretation.focusReading = {
              ...interpretation.focusReading,
              ...llmEnhancement.focusReading,
              llmEnhanced: true,
            };
          }
        }
      } catch (error) {
        this.logger.warn('LLM增强失败，使用本地分析', error);
      }
      
      const layeredInterpretation = this.applyMembershipInterpretation(interpretation, membership);
      return {
        handwriting,
        zi: ziAnalysis,
        interpretation: layeredInterpretation,
        coldReadings,
        followUpQuestions,
        metadata: {
          method: '测字有术 - AI笔迹与语义分析',
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      this.logger.error('测字分析失败', error);
      // 返回一个默认结果而不是抛出异常
      return this.getDefaultResult(zi);
    }
  }
  
  /**
   * 获取默认结果（当分析失败时）
   */
  private getDefaultResult(zi: string): ZiResult {
    const char = zi.charAt(0);
    return {
      handwriting: {
        pressure: 'medium',
        pressureInterpretation: '笔画力度适中',
        stability: 'average',
        stabilityInterpretation: '字迹平稳',
        structure: 'balanced',
        structureInterpretation: '结构疏密有致',
        continuity: 'average',
        continuityInterpretation: '连贯性一般',
        overallStyle: '默认分析',
        personalityInsights: ['稳重', '靠谱'],
      },
      zi: {
        zi: char,
        bushou: '其他',
        bihua: 4,
        wuxing: '土',
        yinyang: '阳',
        jixiong: '平',
        yijing: '乾',
        guaXiang: '卦象深奥',
        components: [char],
        componentMeanings: [`部件"${char}"`],
        associativeMeaning: '此字需细加品味',
        lihefa: ['先离后合：把问题拆开看，再综合决策。'],
        tianziGe: ['填字格-中心位：先看你最在意的核心。'],
        imageryInference: '象形投射：当前状态偏保守求稳，建议先稳情绪再稳动作。',
        probingQuestion: '你最在意的，是这件事的结果，还是关系里的感受？',
        oracleBone: {
          exists: false,
          source: 'JiaGuWen 开源甲骨文字表（缓存回退）',
          imageUrls: [],
          totalImages: 0,
          shownImages: 0,
          previewLocked: false,
          interpretation: `甲骨象形：当前未检索到「${char}」图像，先按部件与意象做近似推断。`,
          note: '该字可能缺少已公开甲骨文释读或图像样本。',
        },
      },
      interpretation: {
        overall: '你写的字结构匀称，整体给人稳重的感觉。',
        career: '你是个有想法的人，适合稳定发展的方向。',
        love: '你是个重感情的人，内心细腻，需要被理解。',
        wealth: '财运平稳，需稳扎稳打。',
        health: '注意身体健康，保持良好作息。',
        advice: ['保持良好生活习惯', '注意休息', '适度运动'],
        premiumHint: '升级会员可解锁完整方向锚点、风险信号和行动计划。',
      },
      coldReadings: ['从你的字来看，是个有想法的人。', '你很重视身边的人和事。', '你是个值得信赖的人。'],
      followUpQuestions: ['最近是否有特别在意的事情？', '这个字是你随意写的，还是有特别的想法？'],
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
    const pressureKeys: Array<'heavy' | 'light' | 'medium'> = ['heavy', 'light', 'medium'];
    const stabilityKeys: Array<'stable' | 'shaky' | 'average'> = ['stable', 'shaky', 'average'];
    const structureKeys: Array<'compact' | 'loose' | 'balanced'> = ['compact', 'loose', 'balanced'];
    const continuityKeys: Array<'connected' | 'broken' | 'average'> = ['connected', 'broken', 'average'];
    
    const pressure = pressureKeys[now % 3] || 'medium';
    const stability = stabilityKeys[(now >> 4) % 3] || 'average';
    const structure = structureKeys[(now >> 8) % 3] || 'balanced';
    const continuity = continuityKeys[(now >> 12) % 3] || 'average';
    
    const pData = handwritingPatterns.pressure[pressure] || handwritingPatterns.pressure['medium'];
    const sData = handwritingPatterns.stability[stability] || handwritingPatterns.stability['average'];
    const strData = handwritingPatterns.structure[structure] || handwritingPatterns.structure['balanced'];
    const cData = handwritingPatterns.continuity[continuity] || handwritingPatterns.continuity['average'];
    
    return {
      pressure,
      pressureInterpretation: pData.interpretation,
      stability,
      stabilityInterpretation: sData.interpretation,
      structure,
      structureInterpretation: strData.interpretation,
      continuity,
      continuityInterpretation: cData.interpretation,
      overallStyle: 'AI模拟笔迹分析（建议接入真实手写识别）',
      personalityInsights: [
        ...(pData.traits || []),
        ...(sData.traits || []),
      ].slice(0, 4),
    };
  }
  
  /**
   * 分析汉字结构
   */
  private analyzeZi(zi: string, membership: MembershipTier): ZiAnalysis {
    const char = zi.charAt(0);
    const bihua = this.countBihua(char);
    const wuxing = this.inferWuxing(char);
    const yinyang = bihua % 2 === 0 ? '阴' : '阳';
    const jixiong = this.inferJixiong(char);
    const yijing = this.getYijing(char);
    
    // 检查是否有预设数据
    const preset = ziComponents[char];
    if (preset) {
      return {
        zi: char,
        bushou: this.getBushou(char),
        bihua,
        wuxing,
        yinyang,
        jixiong,
        yijing,
        guaXiang: this.getGuaXiang(yijing, { wuxing, yinyang, jixiong, bihua }),
        components: preset.parts,
        componentMeanings: preset.meanings,
        associativeMeaning: preset.association,
        lihefa: this.buildLihefa(preset.parts, preset.meanings),
        tianziGe: this.buildTianziGe(char, preset.parts),
        imageryInference: this.buildImageryInference(char, preset.parts),
        probingQuestion: this.buildProbingQuestion(char, preset.parts),
        oracleBone: this.buildOracleBoneInsight(char, preset.parts, membership),
      };
    }
    
    // 自动分析
    return {
      zi: char,
      bushou: this.getBushou(char),
      bihua,
      wuxing,
      yinyang,
      jixiong,
      yijing,
      guaXiang: this.getGuaXiang(yijing, { wuxing, yinyang, jixiong, bihua }),
      components: this.breakDown(char),
      componentMeanings: this.getComponentMeanings(char),
      associativeMeaning: `此字需细加品味，可从字形、字义、字音多角度联想。`,
      lihefa: this.buildLihefa(this.breakDown(char), this.getComponentMeanings(char)),
      tianziGe: this.buildTianziGe(char, this.breakDown(char)),
      imageryInference: this.buildImageryInference(char, this.breakDown(char)),
      probingQuestion: this.buildProbingQuestion(char, this.breakDown(char)),
      oracleBone: this.buildOracleBoneInsight(char, this.breakDown(char), membership),
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
  private generateInterpretation(
    handwriting: HandwritingAnalysis,
    zi: ZiAnalysis,
    focus: FocusProfile,
  ): ZiResult['interpretation'] {
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
    const seed = this.hashSeed(`${zi.zi}-${zi.wuxing}-${handwriting.pressure}-${handwriting.structure}-${zi.jixiong}`);
    const careerLine = this.pickBySeed([
      `从你的字来看，你是个有${handwriting.personalityInsights[0] || '想法'}的人，${zi.wuxing}性较强，适合 ${this.getCareerByWuxing(zi.wuxing)} 方向。`,
      `事业层面，${zi.wuxing}性主导明显，建议把重心放在 ${this.getCareerByWuxing(zi.wuxing)} 相关赛道，先做可验证产出。`,
      `你当前更适合“先拿结果再扩张”的工作节奏，${this.getCareerByWuxing(zi.wuxing)} 类方向更容易放大优势。`,
    ], seed + 11);
    const loveLine = this.pickBySeed([
      `你是个重感情的人，${zi.yinyang === '阳' ? '在感情中较为主动' : '内心细腻，需要被理解'}。`,
      `关系里你更看重“${zi.yinyang === '阳' ? '表达与推进' : '感受与安全感'}”，建议先对齐期待再谈承诺。`,
      `感情议题上，你的表达偏${zi.yinyang}性，越是讲清边界与节奏，越容易减少误会。`,
    ], seed + 17);
    const wealthLine = this.pickBySeed([
      `财运与${zi.wuxing}相关，${zi.jixiong === '吉' ? '正财运不错' : '需稳扎稳打'}。`,
      `财务策略上，建议围绕${zi.wuxing}性节奏来配置：${zi.jixiong === '吉' ? '可稳步推进' : '先守后攻'}。`,
      `当前财运关键词是“${zi.jixiong === '吉' ? '抓机会' : '控风险'}”，重点在现金流与执行纪律。`,
    ], seed + 23);
    const healthLine = this.pickBySeed([
      `注意 ${this.getHealthByWuxing(zi.wuxing)}。`,
      `健康面建议优先关注${this.getHealthByWuxing(zi.wuxing)}，先修复作息再谈负荷提升。`,
      `身心状态上，${zi.wuxing}性较敏感，重点照顾${this.getHealthByWuxing(zi.wuxing)}相关信号。`,
    ], seed + 29);
    
    const base: ZiResult['interpretation'] = {
      overall:
        `${handwriting.pressureInterpretation} ${handwriting.structureInterpretation} ` +
        `离合法显示「${zi.lihefa[0] || '先拆后合'}」，填字格提示「${zi.tianziGe[0] || '先看中心、再看边界'}」。` +
        `${zi.oracleBone.interpretation}`,
      career: careerLine,
      love: loveLine,
      wealth: wealthLine,
      health: healthLine,
      advice: advice.slice(0, 4),
    };
    return this.applyFocusInterpretation(base, zi, handwriting, focus);
  }
  
  /**
   * 生成后续问题（反问）
   */
  private generateFollowUpQuestions(zi: ZiAnalysis, focus: FocusProfile): string[] {
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
    
    if (focus.key !== 'general') {
      questions.unshift(this.getFocusFollowUpQuestion(focus, zi));
    } else {
      // 通用问题
      questions.push('最近是否有特别在意的事情？');
      questions.push('这个字是你随意写的，还是有特别的想法？');
    }
    if (zi.probingQuestion) {
      questions.unshift(zi.probingQuestion);
    }
    
    return questions.slice(0, 2);
  }
  
  /**
   * LLM 增强（可选）
   */
  private async getLLMEnhancement(
    zi: string, 
    handwriting: HandwritingAnalysis, 
    ziAnalysis: ZiAnalysis,
    focus: FocusProfile,
  ): Promise<{
    overall?: string;
    advice?: string[];
    career?: string;
    love?: string;
    wealth?: string;
    health?: string;
    focusReading?: {
      summary?: string;
      anchors?: string[];
      riskSignals?: string[];
      actionPlan?: string[];
    };
  } | null> {
    const apiKey = process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      return null;
    }
    
    try {
      const apiUrl = process.env.LLM_API_URL || process.env.DEEPSEEK_API_URL || 'https://api.apiyi.com/v1/chat/completions';
      const model = process.env.LLM_MODEL || process.env.DEEPSEEK_MODEL || 'gemini-1.5-flash-002';
      
      const response = await axios.post(
        apiUrl,
        {
          model: model,
          temperature: 0.7,
          max_tokens: 900,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `你是一位精通《测字有术》的高阶分析师，深谙中国传统文化和现代心理学。你融合了以下三大核心技术：

【一、笔迹心理学】
- 笔画力度：轻重反映潜意识能量和情绪状态
- 结构松紧：紧凑或松散反映自我认知和决断力
- 连贯性：断笔/涂改反映决策时的犹豫程度
- 稳定性：抖动反映焦虑程度

【二、巴纳姆效应与冷读术】
- 学会说"既像废话又像真话"的模糊预测
- 利用巴纳姆效应：几乎适用于任何处于压力下的现代人
- 通过观察（如果有用户画像信息）进行概率推断
- 用试探性语言"套"信息，必要时用反问策略

【三、汉字拆解与意象联想】
- 离合法：拆解汉字部件（如"安"="宀"+"女"）
- 象形法：根据部件形状联想到具体事物（如"十"像十字路口/医院，"八"像分道扬镳）
- 五行属性：结合金木水火土进行解读
- 意象联想：根据部件含义进行深层解读

【输出要求】
1. 先进行笔迹分析（如果有效）
2. 再进行汉字拆解和意象解读
3. 融入冷读术技巧，让解读"神准"但不失真诚
4. 给出实用心理建议
5. 必要时可以反问用户获取更多信息
6. 必须结合并显式使用：bihua(笔画)、wuxing(五行)、yinyang(阴阳)、jixiong(吉凶)四类锚点
7. 若给出focusAspect，输出必须至少80%围绕该方向，避免泛泛而谈
8. 输出JSON格式：{
  overall: string,
  career?: string,
  love?: string,
  wealth?: string,
  health?: string,
  advice: string[],
  focusReading?: { summary: string, anchors: string[], riskSignals: string[], actionPlan: string[] }
}`,
            },
            {
              role: 'user',
              content: JSON.stringify({
                question: '请深度解读这个字',
                focusAspect: focus.label,
                zi: zi,
                handwriting: {
                  pressure: handwriting.pressure,
                  stability: handwriting.stability,
                  structure: handwriting.structure,
                  continuity: handwriting.continuity,
                  traits: handwriting.personalityInsights,
                  style: handwriting.overallStyle,
                },
                ziAnalysis: {
                  components: ziAnalysis.components,
                  meanings: ziAnalysis.componentMeanings,
                  wuxing: ziAnalysis.wuxing,
                  yinyang: ziAnalysis.yinyang,
                  jixiong: ziAnalysis.jixiong,
                  bihua: ziAnalysis.bihua,
                  // 额外的解读信息
                  xiangxing: this.getXiangxingMeaning(zi),
                  tianGanDiZhi: this.getTianganDizhi(zi),
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

  private normalizeFocusAspect(raw?: string): FocusProfile {
    const text = (raw || '').trim();
    if (!text) return { key: 'general', label: '综合' };
    const mapping: Array<{ key: FocusKey; label: string; patterns: RegExp[] }> = [
      { key: 'career', label: '事业', patterns: [/事业|工作|职业|晋升|跳槽/] },
      { key: 'wealth', label: '财运', patterns: [/财运|财富|赚钱|收入|投资/] },
      { key: 'love', label: '婚恋', patterns: [/婚姻|感情|恋爱|伴侣|桃花/] },
      { key: 'study', label: '学业', patterns: [/学业|考试|升学|学习/] },
      { key: 'health', label: '健康', patterns: [/健康|身体|睡眠|压力|情绪/] },
      { key: 'relationship', label: '人际', patterns: [/人际|关系|同事|合作|沟通/] },
    ];
    const hit = mapping.find((item) => item.patterns.some((pattern) => pattern.test(text)));
    if (hit) return { key: hit.key, label: hit.label };
    return { key: 'general', label: text, custom: text };
  }

  private applyFocusInterpretation(
    base: ZiResult['interpretation'],
    zi: ZiAnalysis,
    handwriting: HandwritingAnalysis,
    focus: FocusProfile,
  ): ZiResult['interpretation'] {
    if (focus.key === 'general') return base;
    const anchors = [
      `笔画锚点：${zi.bihua}画，节奏偏${zi.bihua % 2 === 0 ? '稳中求进' : '先动后稳'}`,
      `五行锚点：${zi.wuxing}性主导，映射到「${focus.label}」议题的核心策略`,
      `阴阳锚点：${zi.yinyang}性，决定你在该议题里的表达方式`,
      `吉凶锚点：${zi.jixiong}，提示当前窗口更适合“${zi.jixiong === '吉' ? '推进' : zi.jixiong === '凶' ? '收敛防错' : '稳态试探'}”`,
    ];
    const focusLine = `你本次聚焦「${focus.label}」，以下用笔画/五行/阴阳/吉凶四锚做定向解读。`;
    const focusedOverall = `${focusLine}${base.overall}`;
    const map: Record<Exclude<FocusKey, 'general'>, string> = {
      career: `事业详解：${anchors[0]}；${anchors[1]}。当前更适合以${this.getCareerByWuxing(zi.wuxing)}为主轴，先拿“可验证成绩”，再谈岗位跃迁。`,
      wealth: `财运详解：${anchors[2]}；${anchors[3]}。本阶段先稳现金流和风险边界，再做增量策略，避免情绪型投入。`,
      love: `婚恋详解：${anchors[2]}；${anchors[1]}。关系关键在“先对齐期待，再对齐行动”，把误会和承诺拆开处理更有效。`,
      study: `学业详解：${anchors[0]}；${anchors[3]}。建议做“7天-14天”双周期复盘，先补短板再冲刺高分区。`,
      health: `健康详解：${anchors[1]}；${anchors[3]}。重点关注${this.getHealthByWuxing(zi.wuxing)}信号，先修复作息与恢复，再提升负荷。`,
      relationship: `人际详解：${anchors[2]}；${anchors[0]}。优先修复关键关系，沟通用“先共情后结论”，减少对抗成本。`,
    };
    const targeted = map[focus.key as Exclude<FocusKey, 'general'>] || `本轮聚焦「${focus.label}」，建议围绕该主题做拆解与行动。`;
    const focusAdvice = this.getFocusAdvice(focus, zi, handwriting);
    const focusReading: NonNullable<ZiResult['interpretation']['focusReading']> = {
      focus: focus.label,
      summary: targeted,
      anchors,
      riskSignals: this.getFocusRiskSignals(focus, zi, handwriting),
      actionPlan: this.getFocusActionPlan(focus, zi),
      llmEnhanced: false,
    };

    return {
      ...base,
      overall: focusedOverall,
      career: focus.key === 'career' ? targeted : base.career,
      wealth: focus.key === 'wealth' ? targeted : base.wealth,
      love: focus.key === 'love' ? targeted : base.love,
      health: focus.key === 'health' ? targeted : base.health,
      advice: [...focusAdvice, ...base.advice].slice(0, 5),
      focusReading,
    };
  }

  private applyMembershipInterpretation(
    interpretation: ZiResult['interpretation'],
    membership: MembershipTier,
  ): ZiResult['interpretation'] {
    if (membership === 'premium' || membership === 'vip') {
      return {
        ...interpretation,
        premiumHint: undefined,
      };
    }
    if (!interpretation.focusReading) {
      return {
        ...interpretation,
        premiumHint: '升级会员可解锁完整方向推演（关键锚点/风险信号/行动计划）。',
      };
    }
    return {
      ...interpretation,
      focusReading: {
        ...interpretation.focusReading,
        anchors: interpretation.focusReading.anchors.slice(0, 1),
        riskSignals: interpretation.focusReading.riskSignals.slice(0, 1),
        actionPlan: interpretation.focusReading.actionPlan.slice(0, 1),
        llmEnhanced: false,
      },
      premiumHint: '当前为方向简版。升级会员可查看完整锚点、风险清单和3步行动计划。',
    };
  }

  private getFocusAdvice(focus: FocusProfile, zi: ZiAnalysis, handwriting: HandwritingAnalysis): string[] {
    const common = [`本轮建议只围绕「${focus.label}」，先做一件最小可执行动作。`];
    const detailMap: Record<Exclude<FocusKey, 'general'>, string> = {
      career: '把接下来7天的关键任务写成可量化目标，并给自己一个截止时间。',
      wealth: '把支出分成“必要/可延后/可取消”三类，先完成现金流盘点。',
      love: '先说感受再说诉求，避免在情绪高点做关系决定。',
      study: '用番茄钟法做2轮深度学习，结束后立刻复盘错因。',
      health: `近期优先修复作息，重点关注${this.getHealthByWuxing(zi.wuxing)}相关信号。`,
      relationship: '先找一个关键对象做一次高质量沟通，避免信息堆积误解。',
    };
    const detail = detailMap[focus.key as Exclude<FocusKey, 'general'>];
    if (!detail) return common;
    if (handwriting.stability === 'shaky') {
      return [...common, '先稳情绪再行动，避免在焦虑时做重大决策。', detail];
    }
    return [...common, detail];
  }

  private getFocusFollowUpQuestion(focus: FocusProfile, zi: ZiAnalysis): string {
    const map: Record<Exclude<FocusKey, 'general'>, string> = {
      career: `围绕事业看，「${zi.zi}」这个字最像你当前哪种职场状态：卡点、转折，还是冲刺？`,
      wealth: `围绕财运看，你最近最想改善的是“收入增长”还是“支出控制”？`,
      love: `围绕婚恋看，你更想先解决“沟通方式”还是“关系定位”？`,
      study: `围绕学业看，你当前最大的阻碍是专注力、方法，还是时间管理？`,
      health: `围绕健康看，你最明显的信号是睡眠、情绪，还是身体疲劳？`,
      relationship: `围绕人际看，你最想先修复哪一段关系？`,
    };
    return map[focus.key as Exclude<FocusKey, 'general'>] || `围绕「${focus.label}」，你最想先突破的具体问题是什么？`;
  }

  private getFocusRiskSignals(
    focus: FocusProfile,
    zi: ZiAnalysis,
    handwriting: HandwritingAnalysis,
  ): string[] {
    const common = [
      handwriting.stability === 'shaky' ? '情绪波动会放大判断偏差。' : '当前状态可执行，但仍需定期复盘。',
      zi.jixiong === '凶' ? '本阶段忌大跨度冒进，先守关键盘。' : '窗口偏中性/偏吉，可稳步推进。',
    ];
    const map: Record<Exclude<FocusKey, 'general'>, string> = {
      career: '避免同时推进过多目标，防止产出分散。',
      wealth: '避免高杠杆与冲动消费，先定止损线。',
      love: '避免在高情绪时下结论，先确认事实再表达诉求。',
      study: '避免只刷题不复盘，错因不清会反复失分。',
      health: '避免透支作息，恢复不足会拖累全部计划。',
      relationship: '避免冷处理拖延，关系问题会累积成本。',
    };
    return [...common, map[focus.key as Exclude<FocusKey, 'general'>]].slice(0, 3);
  }

  private getFocusActionPlan(focus: FocusProfile, zi: ZiAnalysis): string[] {
    const map: Record<Exclude<FocusKey, 'general'>, string[]> = {
      career: [
        '列出本周1个可量化产出，48小时内开工。',
        '把关键协作对象和时间点提前锁定。',
        '每周复盘一次：结果、阻碍、下一步。',
      ],
      wealth: [
        '先做30天现金流表，再定增收目标。',
        '将支出分为必要/可延后/可取消三层。',
        '设置风险上限，超过即暂停。',
      ],
      love: [
        '先说感受，再说需求，最后说可执行请求。',
        '约定一次“无打断沟通”时段。',
        '对关键议题设一个小闭环时间点。',
      ],
      study: [
        '按7天周期做计划，14天做复盘。',
        '每天先做最难模块，再做巩固题。',
        '错题按原因分类并回练。',
      ],
      health: [
        '先把入睡时间固定，再谈训练强度。',
        `重点观察${this.getHealthByWuxing(zi.wuxing)}相关不适并及时调整。`,
        '每周安排至少1天低负荷恢复。',
      ],
      relationship: [
        '先选一段关键关系做修复。',
        '沟通采用“先确认对方感受，再提出诉求”。',
        '给关系修复设置可检验节点。',
      ],
    };
    return map[focus.key as Exclude<FocusKey, 'general'>] || ['围绕该方向先做一件最小可执行动作。'];
  }

  private hashSeed(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  private pickBySeed<T>(arr: T[], seed: number): T {
    if (!arr.length) throw new Error('pickBySeed empty array');
    return arr[seed % arr.length];
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
  
  private getGuaXiang(
    gua: string,
    meta?: { wuxing: string; yinyang: string; jixiong: string; bihua: number },
  ): string {
    const map: Record<string, string> = {
      乾: '乾卦主“健行与开创”。适合主动推进、先立目标后拿结果，但要防止刚过易折。',
      坤: '坤卦主“承载与整合”。先稳基础、聚资源，再谈扩张，贵在耐心与持续。',
      屯: '屯卦主“起步多阻”。眼下宜小步试错、边做边调，忌一次性押注。',
      蒙: '蒙卦主“启蒙与修正”。先补认知盲区，找关键反馈，再进入下一轮行动。',
      需: '需卦主“等待时机”。先蓄势与准备，窗口到了再发力，避免急推。',
      讼: '讼卦主“争议与博弈”。遇分歧先厘清边界和证据，少情绪对抗。',
      师: '师卦主“组织与执行”。适合建立节奏、统一动作，以纪律换结果。',
      比: '比卦主“连接与协同”。借力关系网络更顺，但需选对合作对象。',
      小畜: '小畜卦主“蓄力渐进”。先做可控增量，积小胜为大胜。',
      履: '履卦主“谨慎践行”。按规则前进更稳，重细节可降风险。',
      泰: '泰卦主“通达与顺势”。可适度加速推进，但仍需留出风险缓冲。',
      否: '否卦主“闭塞与回撤”。当前宜收敛阵线、修内功，等待转机再扩张。',
    };
    const base = map[gua] || '卦象偏中性，宜先稳态观察，再做关键决策。';
    if (!meta) return base;
    const strategy = meta.jixiong === '吉' ? '当前窗口可推进' : meta.jixiong === '凶' ? '当前窗口宜防错收敛' : '当前窗口宜稳步试探';
    return `${base} 结合此字：${meta.bihua}画、${meta.wuxing}性、${meta.yinyang}性、${meta.jixiong}势，${strategy}。`;
  }
  
  private breakDown(zi: string): string[] {
    // 简单拆解
    if (zi.length > 1) return zi.split('');
    return [zi];
  }
  
  private getComponentMeanings(zi: string): string[] {
    return this.breakDown(zi).map(c => `部件"${c}"`);
  }

  private async ensureOracleBoneLexicon(): Promise<void> {
    const now = Date.now();
    if (this.oracleBoneLexicon && now - this.oracleBoneLexiconLoadedAt < this.oracleBoneCacheMs) {
      return;
    }
    if (this.oracleBoneLexiconLoading) {
      await this.oracleBoneLexiconLoading;
      return;
    }

    this.oracleBoneLexiconLoading = (async () => {
      try {
        const response = await axios.get<OracleBoneEntry[]>(this.oracleBoneIndexUrl, {
          timeout: 5000,
        });
        const map = this.createOracleBoneMap(response.data || []);
        if (map.size) {
          this.oracleBoneLexicon = map;
          this.oracleBoneLexiconLoadedAt = Date.now();
          return;
        }
      } catch (error) {
        this.logger.warn(`甲骨文字表在线加载失败，使用内置词表: ${(error as Error).message}`);
      }
      this.oracleBoneLexicon = this.getOracleFallbackMap();
      this.oracleBoneLexiconLoadedAt = Date.now();
    })();

    try {
      await this.oracleBoneLexiconLoading;
    } finally {
      this.oracleBoneLexiconLoading = null;
    }
  }

  private createOracleBoneMap(entries: OracleBoneEntry[]): Map<string, string[]> {
    const map = new Map<string, string[]>();
    for (const item of entries) {
      const name = (item?.name || '').trim();
      const image = (item?.image || '').trim();
      if (!name || !image || name.length !== 1) continue;
      const urls = map.get(name) || [];
      urls.push(`${this.oracleBoneImageBaseUrl}${image}`);
      map.set(name, urls);
    }
    return map;
  }

  private getOracleFallbackMap(): Map<string, string[]> {
    const rawMap: Record<string, string[]> = ORACLE_BONE_SNAPSHOT;
    const map = new Map<string, string[]>();
    for (const [key, images] of Object.entries(rawMap)) {
      map.set(
        key,
        images.map((img) => `${this.oracleBoneImageBaseUrl}${img}`),
      );
    }
    return map;
  }

  private buildOracleBoneInsight(zi: string, parts: string[], membership: MembershipTier): ZiAnalysis['oracleBone'] {
    const candidates = this.normalizeOracleLookupChars(zi, parts);
    const fullImages = this.findOracleImagesByCandidates(candidates).slice(0, 3);
    const isPaid = membership === 'premium' || membership === 'vip';
    const images = isPaid ? fullImages : fullImages.slice(0, 1);
    const previewLocked = !isPaid && fullImages.length > images.length;
    const xiang = this.getXiangxingMeaning(zi);
    if (images.length > 0) {
      const variantText = fullImages.length > 1
        ? `可见${fullImages.length}种常见异体，会员版更强调“同字多形、同象异势”的差异。`
        : '当前仅收录到少量字形样本，重在看象意主轴。';
      return {
        exists: true,
        source: 'JiaGuWen 开源甲骨文字表',
        imageUrls: images,
        totalImages: fullImages.length,
        shownImages: images.length,
        previewLocked,
        interpretation:
          `甲骨象形：围绕「${zi}」可见“${xiang}”意象。` +
          `结合部件「${parts.join('、') || zi}」，多指向“先定核心，再开路径”的结构逻辑。${variantText}`,
        note: isPaid
          ? '会员已解锁完整图像与异体视角，建议结合离合法交叉验证。'
          : '当前为简版展示，升级会员可查看更多异体图像与差异解读。',
      };
    }
    return {
      exists: false,
      source: 'JiaGuWen 开源甲骨文字表',
      imageUrls: [],
      totalImages: 0,
      shownImages: 0,
      previewLocked: false,
      interpretation:
        `甲骨象形：暂未检索到「${zi}」直出图像，已按部件意象“${parts.join('、') || zi}”做近似推断。` +
        `其核心象意仍可归纳为「${xiang}」并用于当前问题判断。`,
      note: '该字可能缺少公认图像样本；可在对话中继续追问“部件原型-现实映射”的细化链路。',
    };
  }

  private normalizeOracleLookupChars(zi: string, parts: string[]): string[] {
    const simpleToTraditional: Record<string, string> = {
      爱: '愛',
      运: '運',
      开: '開',
      门: '門',
      问: '問',
      乐: '樂',
    };
    const proxyMap: Record<string, string[]> = {
      开: ['门', '口', '人'],
      愛: ['心', '人'],
      爱: ['心', '人'],
      运: ['云', '人'],
      運: ['云', '人'],
      学: ['子', '门'],
      财: ['贝', '口', '人'],
    };
    const list = new Set<string>();
    list.add(zi);
    if (simpleToTraditional[zi]) list.add(simpleToTraditional[zi]);
    for (const part of parts) {
      if (part) list.add(part);
      if (simpleToTraditional[part]) list.add(simpleToTraditional[part]);
    }
    for (const p of proxyMap[zi] || []) list.add(p);
    return Array.from(list);
  }

  private findOracleImagesByCandidates(candidates: string[]): string[] {
    const urls: string[] = [];
    for (const candidate of candidates) {
      const hit = this.oracleBoneLexicon?.get(candidate) || [];
      for (const url of hit) {
        if (!urls.includes(url)) urls.push(url);
        if (urls.length >= 6) return urls;
      }
    }
    return urls;
  }

  private buildLihefa(parts: string[], meanings: string[]): string[] {
    if (!parts.length) return ['先离后合：把问题拆开看，再综合决策。'];
    const lines: string[] = [];
    const first = parts[0];
    const second = parts[1];
    lines.push(`离：先看外层「${first}」意象，通常代表你表层正在应对的现实压力。`);
    if (second) {
      lines.push(`合：再看内层「${second}」意象，往往对应你真正挂心的核心诉求。`);
    }
    lines.push(`转：把${parts.join('、')}合起来看，说明你现在在“现实安排”和“内在感受”之间求平衡。`);
    if (meanings[0]) {
      lines.push(`证：从部件含义看「${meanings[0]}」，你的问题不是没答案，而是还在等待更稳妥的时机。`);
    }
    return lines.slice(0, 4);
  }

  private buildTianziGe(zi: string, parts: string[]): string[] {
    const uniqueParts = Array.from(new Set(parts.filter(Boolean)));
    if (uniqueParts.length <= 1) {
      const yinyang = this.countBihua(zi) % 2 === 0 ? '阴' : '阳';
      const jixiong = this.inferJixiong(zi);
      return [
        `填字格-中心位：以「${zi}」为核，说明你当前是“单核关注”，最在意的是同一件事的结果。`,
        `填字格-边界位：${yinyang}性表达更明显，说明你处理外界时更看重“${yinyang === '阳' ? '主动推进' : '情绪与关系平衡'}”。`,
        `填字格-落点：当前吉凶为「${jixiong}」，建议先做小步验证，再决定是否扩大行动。`,
      ];
    }
    const center = uniqueParts[Math.floor(uniqueParts.length / 2)] || zi;
    const outer = uniqueParts[0] || zi;
    return [
      `填字格-中心位：${center}，通常是你此刻最难放下的念头。`,
      `填字格-边界位：${outer}，反映你对外界规则或他人期待的顾虑。`,
      `填字格-落点：建议先处理“中心位”情绪，再处理“边界位”行动，效率会更高。`,
    ];
  }

  private buildImageryInference(zi: string, parts: string[]): string {
    const xiang = this.getXiangxingMeaning(zi);
    const core = parts.join('+') || zi;
    return `象形投射：${zi}可见「${xiang}」，部件组合为「${core}」，这往往对应“外在局势在变、内在仍想稳住”的状态。`;
  }

  private buildProbingQuestion(zi: string, parts: string[]): string {
    const focus = parts[1] || parts[0] || zi;
    return `反问：你写「${zi}」时，把注意力更多放在「${focus}」这部分了吗？这通常指向你最在意的那一环。`;
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
  
  // 象形意义 - 根据字形联想到具体事物
  private getXiangxingMeaning(zi: string): string {
    const xiangxingMap: Record<string, string> = {
      '一': '地平线、水平面、稳定的基础',
      '二': '天地、两仪、对立统一',
      '三': '天地人三才、多数',
      '十': '十字路口、醫院、方向选择',
      '人': '人侧立、顶天立地',
      '八': '分道扬镳、分离、拓展',
      '卜': '占卜、预测、抉择',
      '冖': '覆盖、遮蔽、屋顶',
      '宀': '房屋、 家、 稳定',
      '口': '嘴巴、出口、容纳',
      '土': '土地、基础、承载',
      '士': '男士、知识分子、稳重',
      '女': '女性、柔弱、婚姻',
      '子': '孩子、种子、延续',
      '屮': '植物萌发、生长',
      '山': '高山、稳重、阻碍',
      '工': '工作、工程、规矩',
      '干': '干燥、干预、干涉',
      '广': '广字旁、宽敞、开放',
      '之': '前往、到达、过程',
      '心': '心脏、想法、核心',
      '忄': '竖心旁、情绪、心理',
      '戈': '武器、战争、捍卫',
      '手': '手、能力、掌控',
      '攵': '敲打、行为、变化',
      '支': '支持、分支、分散',
      '日': '太阳、时间、光明',
      '月': '月亮、身体、周期',
      '木': '树木、生长、自然',
      '欠': '欠缺、不足、渴望',
      '止': '停止、阻止、立场',
      '歹': '死亡、危险、坏',
      '殳': '敲打、威胁、压力',
      '比': '比较、竞争、对称',
      '瓦': '陶器、屋顶、建筑',
      '牙': '牙齿、发育、年轻',
      '牛': '牛、勤劳、固执',
      '犬': '狗、忠诚、守护',
      '玄': '玄妙、深奥、神秘',
      '玉': '玉石、美好、高贵',
      '王': '国王、权力、统治',
      '瓜': '瓜果、延续、缠绕',
      '甘': '甘甜、愿意、满足',
      '生': '生命、生长、生活',
      '用': '使用、功能、作用',
      '田': '田地、财富、生产',
      '疋': '足、到达、补充',
      '疒': '疾病、问题、困难',
      '癶': '古代占卜、登攀',
      '白': '白色��纯洁、空白',
      '皮': '皮肤、表面、剥离',
      '皿': '器皿、容器、承受',
      '矛': '矛武器、攻击、冲突',
      '矢': '箭、直线、速度',
      '石': '石头、坚硬、障碍',
      '示': '启示、显示、神灵',
      '禸': '陷阱、網羅、困住',
      '禾': '庄稼、收成、民生',
      '竹': '竹子、高洁、节节高',
      '米': '米粮、食物、基础',
      '糸': '丝线、联系、缠绕',
      '缶': '陶器、储存、封闭',
      '网': '罗网、陷阱、连接',
      '羊': '羊、吉祥、温和',
      '羽': '羽毛、飞翔、自由',
      '老': '老人、经验、传统',
      '而': '而且、持续、脸面',
      '耒': '农具、耕种、劳作',
      '耳': '耳朵、倾听、附属',
      '聿': '笔书写、记录、文',
      '肉': '肉身体、欲望、实质',
      '臣': '臣子、臣服、辅助',
      '自': '自己、自然、源头',
      '至': '到达、极致、到来',
      '臼': '臼齿、咀嚼、基础',
      '舌': '舌头、语言、表达',
      '舛': '违背、冲突、不顺',
      '舟': '船、运输、漂泊',
      '艮': '山艮、停止、稳重',
      '色': '颜色、欲望、外表',
      '艸': '草、生长、野蛮',
      '虍': '老虎、威猛、危险',
      '虫': '虫、小问题、慢性',
      '血': '血液、生命、源头',
      '行': '行走、行动、过程',
      '衣': '衣服、外表、掩盖',
      '襾': '覆盖、包裹、包裹',
    };
    return xiangxingMap[zi] || '待解读';
  }
  
  // 天干地支对应（简化版）
  private getTianganDizhi(zi: string): { tianGan: string; diZhi: string; naxing: string } {
    // 根据字的读音或部首推断（简化版）
    const tianGanMap: Record<string, string[]> = {
      '甲': ['甲', '木'], '乙': ['乙', '木'], 
      '丙': ['丙', '火'], '丁': ['丁', '火'],
      '戊': ['戊', '土'], '己': ['己', '土'],
      '庚': ['庚', '金'], '辛': ['辛', '金'],
      '壬': ['壬', '水'], '癸': ['癸', '水'],
    };
    const diZhiMap: Record<string, string[]> = {
      '子': ['子', '水'], '丑': ['丑', '土'], '寅': ['寅', '木'], '卯': ['卯', '木'],
      '辰': ['辰', '土'], '巳': ['巳', '火'], '午': ['午', '火'], '未': ['未', '土'],
      '申': ['申', '金'], '酉': ['酉', '金'], '戌': ['戌', '土'], '亥': ['亥', '水'],
    };
    
    // 尝试从字本身获取
    if (tianGanMap[zi]) return { tianGan: tianGanMap[zi][0], diZhi: '', naxing: tianGanMap[zi][1] };
    if (diZhiMap[zi]) return { tianGan: '', diZhi: diZhiMap[zi][0], naxing: diZhiMap[zi][1] };
    
    // 根据部首推断
    const bushou = this.getBushou(zi);
    if (tianGanMap[bushou]) return { tianGan: tianGanMap[bushou][0], diZhi: '', naxing: tianGanMap[bushou][1] };
    if (diZhiMap[bushou]) return { tianGan: '', diZhi: diZhiMap[bushou][0], naxing: diZhiMap[bushou][1] };
    
    return { tianGan: '', diZhi: '', naxing: '' };
  }
}
