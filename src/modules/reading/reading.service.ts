import { Injectable } from '@nestjs/common';

export type DivinationCategory = 'career' | 'love' | 'wealth' | 'health' | 'growth' | 'general';

export interface DivinationResult {
  id: string;
  question: string;
  category: DivinationCategory;
  
  // 六爻卦象
  hexagram: {
    original: string;      // 本卦
    originalName: string;
    changed: string;       // 变卦
    changedName: string;
    lines: string[];       // 六爻
    yaoDescriptions: string[];
  };
  
  // 解读
  interpretation: {
    overall: string;       // 总体运势
    situation: string;     // 当前形势
    guidance: string;      // 指导建议
  };
  
  // 行动建议
  recommendations: string[];
  
  // 时机判断
  timing: {
    suitable: string;      // 适合时机
    caution: string;       // 需要注意
  };
  
  // 文化溯源
  culturalSource?: string;
  
  metadata: {
    generatedAt: string;
    method: string;
  };
}

@Injectable()
export class ReadingService {
  // 六十四卦数据
  private hexagrams: Record<string, {
    name: string;
    meaning: string;
    trigrams: string;
    advice: string;
    timing: string;
  }> = {
    '乾': { 
      name: '乾为天', 
      meaning: '象征天、刚健、创造。代表积极进取、事业发达、龙腾四海。', 
      trigrams: '☰☰',
      advice: '此时宜主动出击，把握机遇，展现才华',
      timing: '万事皆宜，尤其利于事业开拓'
    },
    '坤': { 
      name: '坤为地', 
      meaning: '象征地、柔顺、承载。代表稳健务实、包容有德、母仪天下。', 
      trigrams: '☷☷',
      advice: '宜稳扎稳打，以柔克刚，厚德载物',
      timing: '宜积蓄力量，不宜冒进'
    },
    '屯': { 
      name: '水雷屯', 
      meaning: '象征起始维艰。万物初生，需耐心积累、草创艰难。', 
      trigrams: '☵☳',
      advice: '初创时期，宜耐心筹备，稳步推进',
      timing: '万事开头难，需耐心等待时机'
    },
    '蒙': { 
      name: '山水蒙', 
      meaning: '象征蒙昧待启。求学者虚心，受教则吉、童蒙求我。', 
      trigrams: '☶☵',
      advice: '此时宜学习请教，虚心接受指导',
      timing: '利于启蒙、学习新知识'
    },
    '需': { 
      name: '水天需', 
      meaning: '象征等待时机。有需求需耐心等待、待机而动、险在前也。', 
      trigrams: '☵☰',
      advice: '不可急于求成，需耐心等待合适时机',
      timing: '宜静待时机，不宜盲目行动'
    },
    '讼': { 
      name: '天水讼', 
      meaning: '象征争讼。宜和解，慎争强，谦让则吉、不永所事。', 
      trigrams: '☰☵',
      advice: '尽量避免冲突，以和为贵，协商解决',
      timing: '需谨慎行事，避免争执'
    },
    '师': { 
      name: '地水师', 
      meaning: '象征军队、群众。领导有方则无不利、贞丈人吉。', 
      trigrams: '☷☵',
      advice: '宜整合资源，发挥团队力量，领导者需公正',
      timing: '利于团结协作，共同行动'
    },
    '比': { 
      name: '水地比', 
      meaning: '象征亲比、依附。择善而从，亲密无间、比吉。', 
      trigrams: '☵☷',
      advice: '宜广结善缘，亲近贤者，互相扶持',
      timing: '利于建立合作关系'
    },
    '小畜': { 
      name: '风天小畜', 
      meaning: '象征小有积蓄。力量尚弱，需继续积累、密云不雨。', 
      trigrams: '☴☰',
      advice: '需耐心积累，积蓄力量，等待成熟',
      timing: '小有收获，但需继续努力'
    },
    '履': { 
      name: '天泽履', 
      meaning: '象征实践、履行。脚踏实地，循序渐进、履虎尾不咥人。', 
      trigrams: '☰☱',
      advice: '谨慎行事，循序渐进，虽险但吉',
      timing: '宜谨慎行动，步步为营'
    },
    '泰': { 
      name: '地天泰', 
      meaning: '象征通泰、亨通。天地交泰，万物亨通、小往大来。', 
      trigrams: '☷☰',
      advice: '诸事顺利，宜把握时机，积极进取',
      timing: '万事皆宜，运势上扬'
    },
    '否': { 
      name: '天地否', 
      meaning: '象征闭塞不通。时机未到，宜守不宜动、大往小来。', 
      trigrams: '☰☷',
      advice: '宜静守待机，积蓄力量，不宜冒进',
      timing: '运势低迷，需耐心等待'
    },
    '同人': { 
      name: '天火同人', 
      meaning: '象征同人同心。与志同道合者共谋可成、于门乎野。', 
      trigrams: '☰☲',
      advice: '宜寻求志同道合者，合作共事',
      timing: '利于社交、团队合作'
    },
    '大有': { 
      name: '火天大有', 
      meaning: '象征富有、丰盛。柔得尊位，大有所成、厥孚交如。', 
      trigrams: '☲☰',
      advice: '运势鼎盛，宜把握机遇，大展宏图',
      timing: '诸事大吉，财运事业双丰收'
    },
    '谦': { 
      name: '地山谦', 
      meaning: '象征谦虚。君子以裒多益寡，称物平施、地中有山。', 
      trigrams: '☷☶',
      advice: '保持谦虚姿态，低调行事，广受欢迎',
      timing: '谦虚使人进步，运势平稳'
    },
    '豫': { 
      name: '雷地豫', 
      meaning: '象征欢乐、预备。万物欣豫，春雷动地、介于石。', 
      trigrams: '☳☷',
      advice: '顺势而为，但需有备无患，居安思危',
      timing: '运势上扬，宜欢乐但不放纵'
    },
    '随': { 
      name: '泽雷随', 
      meaning: '象征随从、顺应。随时而动，元亨利贞、无咎。', 
      trigrams: '☱☳',
      advice: '宜顺势而为，随机应变，但需有原则',
      timing: '宜灵活变通，随机应变'
    },
    '蛊': { 
      name: '山风蛊', 
      meaning: '象征腐败、革新。振疲起衰，除旧布新、干父之蛊。', 
      trigrams: '☶☴',
      advice: '需解决遗留问题，革新除弊，重新开始',
      timing: '宜改革整顿，重整旗鼓'
    },
    '临': { 
      name: '地泽临', 
      meaning: '象征临事、领导。君临天下，教思无穷、至于八月。', 
      trigrams: '☷☱',
      advice: '宜发挥领导力，主动担当，关怀他人',
      timing: '运势上升，宜把握权力和机会'
    },
    '观': { 
      name: '风地观', 
      meaning: '象征观察、审视。仰观俯察，深入了解、盥而不荐。', 
      trigrams: '☴☷',
      advice: '宜观察学习，深入了解后再做决策',
      timing: '宜观察了解，不宜急于行动'
    },
    '噬嗑': { 
      name: '火雷噬嗑', 
      meaning: '象征刑狱、决断。明刑弼教，治狱之道、颐中有物。', 
      trigrams: '☲☳',
      advice: '需果断决策，消除障碍，公正处理',
      timing: '宜果断行动，排除万难'
    },
    '贲': { 
      name: '山火贲', 
      meaning: '象征文饰、修饰。文明以止，华丽其外、贲其须。', 
      trigrams: '☶☲',
      advice: '宜注重外在形象，但勿过度修饰',
      timing: '宜包装推广，展现才华'
    },
    '剥': { 
      name: '山地剥', 
      meaning: '象征剥落、侵蚀。小人道长，君子道消、山附于地。', 
      trigrams: '☶☷',
      advice: '运势不佳，需谨慎防守，保护根基',
      timing: '宜保守待机，不宜主动出击'
    },
    '复': { 
      name: '地雷复', 
      meaning: '象征复归、复兴。剥极必复，一阳复起、七日来复。', 
      trigrams: '☷☳',
      advice: '否极泰来，宜重新开始，恢复元气',
      timing: '运势转好，宜重新出发'
    },
    '无妄': { 
      name: '天雷无妄', 
      meaning: '象征无妄、真诚。不妄为，顺其自然、元亨利贞。', 
      trigrams: '☰☳',
      advice: '保持真诚自然，不耍小聪明，顺势而为',
      timing: '宜脚踏实地，真诚待人'
    },
    '大畜': { 
      name: '山天大畜', 
      meaning: '象征大积蓄。畜德养贤，厚积薄发、不家食吉。', 
      trigrams: '☶☰',
      advice: '宜积蓄力量，学习提升，等待厚发',
      timing: '宜学习积累，不急于求成'
    },
    '颐': { 
      name: '山雷颐', 
      meaning: '象征颐养、养身。养生之道，自求口实、观其自养。', 
      trigrams: '☶☳',
      advice: '宜注重休养，调养身心，颐养天年',
      timing: '宜养生休息，调理身体'
    },
    '大过': { 
      name: '泽风大过', 
      meaning: '象征过度、超越。独立不惧，跨越式发展、栋桡乎上。', 
      trigrams: '☱☴',
      advice: '需有非常大勇气和决心，敢于突破常规',
      timing: '宜冒险突破，但需谨慎评估'
    },
    '坎': { 
      name: '坎为水', 
      meaning: '象征险难、陷困。重险当前，艰难险阻、水习坎。', 
      trigrams: '☵☵',
      advice: '保持谨慎，坚守正道，等待脱困',
      timing: '运势险阻，需耐心等待'
    },
    '离': { 
      name: '离为火', 
      meaning: '象征光明、依附。附丽中正，光明鼎盛、柔丽乎中正。', 
      trigrams: '☲☲',
      advice: '宜依附正道，展现才华，光明磊落',
      timing: '运势光明，宜展现自我'
    },
    '咸': { 
      name: '泽山咸', 
      meaning: '象征感应、交感。情投意合，心心相印、柔上而刚下。', 
      trigrams: '☱☶',
      advice: '宜真诚交流，建立感情，感应共鸣',
      timing: '利于感情发展，人际交往'
    },
    '恒': { 
      name: '雷风恒', 
      meaning: '象征恒久、持久。恒心恒行，持之以恒、雷风恒。', 
      trigrams: '☳☴',
      advice: '需持之以恒，坚持不懈，莫急于求成',
      timing: '宜长期坚持，不宜轻易放弃'
    },
    '遯': { 
      name: '天山遯', 
      meaning: '象征退隐、回避。退避三舍，待时而动、肥遯无不利。', 
      trigrams: '☰☶',
      advice: '形势不利时，宜退避隐藏，保存实力',
      timing: '宜隐忍待机，不宜强争'
    },
    '大壮': { 
      name: '雷天大壮', 
      meaning: '象征壮盛、强大。声势浩大，强势出击、羝羊触藩。', 
      trigrams: '☳☰',
      advice: '运势强盛，宜把握机会，积极行动',
      timing: '运势正旺，宜乘胜追击'
    },
    '晋': { 
      name: '火地晋', 
      meaning: '象征晋升、前进。日出地上，蒸蒸日上、康侯用锡马。', 
      trigrams: '☲☷',
      advice: '宜积极进取，争取上升，步步高升',
      timing: '运势上升，宜争取进步'
    },
    '明夷': { 
      name: '地火明夷', 
      meaning: '象征受伤、晦暗。光明受伤，韬光养晦、明入地中。', 
      trigrams: '☷☲',
      advice: '运势不佳，宜隐忍低调，保存实力',
      timing: '宜静养待机，不宜强出头'
    },
    '家人': { 
      name: '风火家人', 
      meaning: '象征家庭、和睦。齐家之道，家和万事兴、闲有家。', 
      trigrams: '☴☲',
      advice: '宜注重家庭和睦，亲情为重',
      timing: '利家庭事务，宜维护亲情'
    },
    '睽': { 
      name: '火泽睽', 
      meaning: '象征乖离、分离。同床异梦，事与愿违、睽小事吉。', 
      trigrams: '☲☱',
      advice: '注意关系疏离，需沟通化解矛盾',
      timing: '需谨慎处理人际关系'
    },
    '蹇': { 
      name: '水山蹇', 
      meaning: '象征困难、阻滞。前路艰难，止而待时、往得中也。', 
      trigrams: '☵☶',
      advice: '运势受阻，需耐心等待，不宜强行',
      timing: '宜等待时机，不宜冒进'
    },
    '解': { 
      name: '雷水解', 
      meaning: '象征解除、解难。冬雷春雨，困难解除、雷雨作解。', 
      trigrams: '☳☵',
      advice: '困难将解，宜把握时机，解除束缚',
      timing: '运势转好，困难将解除'
    },
    '损': { 
      name: '山泽损', 
      meaning: '象征减损、损失。有舍有得，先舍后得、曷之用二簋。', 
      trigrams: '☶☱',
      advice: '需适当舍弃，才能获得，勿过于计较',
      timing: '宜慷慨付出，会有回报'
    },
    '益': { 
      name: '风雷益', 
      meaning: '象征增益、受益。损上益下，有所作为、利有攸往。', 
      trigrams: '☴☳',
      advice: '宜主动帮助他人，也会获得收益',
      timing: '运势上升，宜积极行动'
    },
    '夬': { 
      name: '泽天夬', 
      meaning: '象征决断、决定。决而能和，当机立断、扬于王庭。', 
      trigrams: '☱☰',
      advice: '需果断决策，快刀斩乱麻',
      timing: '宜果断行动，不宜拖延'
    },
    '姤': { 
      name: '天风姤', 
      meaning: '象征相遇、邂逅。不期而遇，机缘巧合、勿用取女。', 
      trigrams: '☰☴',
      advice: '有新机遇，但需谨慎选择',
      timing: '有新缘分或机会出现'
    },
    '萃': { 
      name: '泽地萃', 
      meaning: '象征聚集、会聚。群英荟萃，人才济济、聚以正也。', 
      trigrams: '☱☷',
      advice: '宜广结人脉，聚集资源，共同发展',
      timing: '宜社交聚会，拓展人脉'
    },
    '升': { 
      name: '地风升', 
      meaning: '象征上升、进升。循序渐进，步步高升、允升吉。', 
      trigrams: '☷☴',
      advice: '宜稳步上升，积累成就，不急于求成',
      timing: '运势上升，宜把握机会'
    },
    '困': { 
      name: '泽水困', 
      meaning: '象征困顿、困境。穷困潦倒，坚守正道、困而不失其志。', 
      trigrams: '☱☵',
      advice: '运势困顿，需坚守，等待转机',
      timing: '运势低迷，需耐心等待'
    },
    '井': { 
      name: '水风井', 
      meaning: '象征井泉、滋养。井养不穷，修身养性、井收勿幕。', 
      trigrams: '☵☴',
      advice: '宜修养身心，积蓄能量，厚积薄发',
      timing: '宜养精蓄锐，不宜冒进'
    },
    '革': { 
      name: '泽火革', 
      meaning: '象征变革、改革。革故鼎新，推陈出新、己日乃孚。', 
      trigrams: '☱☲',
      advice: '宜改革创新，破旧立新，把握时机',
      timing: '宜变革创新，与时俱进'
    },
    '鼎': { 
      name: '火风鼎', 
      meaning: '象征鼎立、稳定。定鼎之功，权位稳固、鼎元吉。', 
      trigrams: '☲☴',
      advice: '宜稳固地位，树立权威，稳步发展',
      timing: '运势稳定，宜巩固成果'
    },
    '震': { 
      name: '震为雷', 
      meaning: '象征震动、惊雷。一鸣惊人，惊恐成长、震来虩虩。', 
      trigrams: '☳☳',
      advice: '虽遇惊吓，但能成长，需临危不惧',
      timing: '有突发事件，需保持镇定'
    },
    '艮': { 
      name: '艮为山', 
      meaning: '象征停止、静止。适时而止，见险而止、艮其背不获其身。', 
      trigrams: '☶☶',
      advice: '宜适可而止，克制欲望，见好就收',
      timing: '宜静止观察，不宜冲动'
    },
    '渐': { 
      name: '风山渐', 
      meaning: '象征渐进、稳步。循序渐进，稳步前进、妇孕不育凶。', 
      trigrams: '☴☶',
      advice: '宜稳步推进，按部就班，不急于求成',
      timing: '宜循序渐进，步步为营'
    },
    '归妹': { 
      name: '雷泽归妹', 
      meaning: '象征归嫁、归宿。天涯同归，修成正果、帝乙归妹。', 
      trigrams: '☳☱',
      advice: '有归宿之象，宜追求稳定关系',
      timing: '利于感情稳定或归宿'
    },
    '丰': { 
      name: '雷火丰', 
      meaning: '象征丰盛、丰盈。丰衣足食，事业鼎盛、宜日中。', 
      trigrams: '☳☲',
      advice: '运势鼎盛，宜把握当下，尽情发展',
      timing: '运势高峰期，宜大展拳脚'
    },
    '旅': { 
      name: '火山旅', 
      meaning: '象征旅行、漂泊。羁旅天涯，适可而止、旅琐琐。', 
      trigrams: '☲☶',
      advice: '如漂泊在外，宜安分守己，随遇而安',
      timing: '运势不定，宜随遇而安'
    },
    '巽': { 
      name: '巽为风', 
      meaning: '象征顺从、渗透。随风而动，柔顺谦逊、巽在床下。', 
      trigrams: '☴☴',
      advice: '宜顺从大势，谦逊行事，循序渐进',
      timing: '宜柔顺应对，不宜强争'
    },
    '兑': { 
      name: '兑为泽', 
      meaning: '象征喜悦、言说。和颜悦色，口灿莲花、兑亨利贞。', 
      trigrams: '☱☱',
      advice: '宜保持愉快心情，沟通交流，广结善缘',
      timing: '运势和悦，宜社交往来'
    },
    '涣': { 
      name: '风水涣', 
      meaning: '象征涣散、离散。人心离散，宜收拢人心、用拯马壮。', 
      trigrams: '☴☵',
      advice: '注意人心离散，需重新凝聚',
      timing: '运势分散，宜整合资源'
    },
    '节': { 
      name: '水泽节', 
      meaning: '象征节制、适度。适度而行，有所节制、不节则嗟。', 
      trigrams: '☵☱',
      advice: '需有所节制，适度而行，避免过度',
      timing: '宜克制欲望，适度而行'
    },
    '中孚': { 
      name: '风泽中孚', 
      meaning: '象征诚信、真心。诚心诚意，以诚待人、中孚豚鱼吉。', 
      trigrams: '☴☱',
      advice: '宜保持真诚，诚信待人，必有回报',
      timing: '宜真心实意，诚信用事'
    },
    '小过': { 
      name: '雷山小过', 
      meaning: '象征小有过越。小有超过，适度的冒险、可小事不可大事。', 
      trigrams: '☳☶',
      advice: '可做小事，大事需谨慎，不可冒进',
      timing: '小有作为，但需谨慎'
    },
    '既济': { 
      name: '水火既济', 
      meaning: '象征成功、完成。大功告成，功德圆满、亨小利贞。', 
      trigrams: '☵☲',
      advice: '大功告成，宜巩固成果，防止松懈',
      timing: '诸事已成功，宜守成'
    },
    '未济': { 
      name: '火水未济', 
      meaning: '象征未完成。有待完成，继续努力、征凶利涉大川。', 
      trigrams: '☲☵',
      advice: '尚未成功，需继续努力，不可松懈',
      timing: '还需努力，不宜放松'
    },
  };

  // 爻辞数据（简化版）
  private yaoMeanings: Record<number, string[]> = {
    6: ['老阳 - 变化之极', '事之将变，应把握时机'],
    8: ['少阴', '稳定坚守，保持现状'],
    7: ['少阳', '积极进取，主动作为'],
    9: ['老阴 - 动则变', '静待变化，不宜妄动'],
  };

  async generate(dto: {
    question: string;
    category?: DivinationCategory;
    userId?: string;
  }): Promise<DivinationResult> {
    // 使用时间戳生成卦象
    const now = Date.now();
    const { original, changed, lines } = this.generateHexagram(now);
    
    const originalInfo = this.hexagrams[original];
    const changedInfo = this.hexagrams[changed];
    
    const result: DivinationResult = {
      id: `reading_${now}`,
      question: dto.question,
      category: dto.category ?? 'general',
      
      hexagram: {
        original,
        originalName: originalInfo?.name ?? '未知',
        changed,
        changedName: changedInfo?.name ?? '未知',
        lines,
        yaoDescriptions: lines.map((l, i) => 
          `${['初', '二', '三', '四', '五', '上'][i]}：${this.getYaoDescription(l)}`
        ),
      },
      
      interpretation: {
        overall: originalInfo?.meaning ?? '卦象显示...',
        situation: this.analyzeSituation(original, changed),
        guidance: originalInfo?.advice ?? '顺其自然，静待时机',
      },
      
      recommendations: this.generateRecommendations(original, changed, dto.category),
      
      timing: {
        suitable: originalInfo?.timing ?? '时机成熟时自会有所显现',
        caution: this.getCaution(original, changed),
      },
      
      culturalSource: `出自《周易》六十四卦 ${originalInfo?.name ?? original} 卦`,
      
      metadata: {
        generatedAt: new Date().toISOString(),
        method: '六爻起卦（时间起卦法）',
      },
    };

    return result;
  }

  // 生成卦象
  private generateHexagram(seed: number): { original: string; changed: string; lines: string[] } {
    const lines: string[] = [];
    
    // 用时间戳生成 6 爻
    // 1-4 为少阳(7), 5-6 为少阴(8), 7-8 为老阳(9), 9 为老阴(6)
    // 简化：用随机 + seed 的方式
    for (let i = 0; i < 6; i++) {
      const value = ((seed + i * 17) % 10) + 1;
      if (value <= 3) lines.push('7'); // 少阳
      else if (value <= 6) lines.push('8'); // 少阴
      else if (value <= 8) lines.push('9'); // 老阳
      else lines.push('6'); // 老阴
    }
    
    // 将爻转换为卦
    const original = this.linesToHexagram(lines.map(l => l === '6' || l === '9' ? '0' : (parseInt(l) % 2 === 1 ? '1' : '0')));
    
    // 变卦：老阳变阴，老阴变阳
    const changedLines = lines.map(l => {
      if (l === '9') return '6'; // 老阳变老阴
      if (l === '6') return '9'; // 老阴变老阳
      return l;
    });
    const changed = this.linesToHexagram(changedLines.map(l => l === '6' || l === '9' ? '0' : (parseInt(l) % 2 === 1 ? '1' : '0')));
    
    return { original, changed, lines };
  }

  // 爻转换为卦
  private linesToHexagram(binaryLines: string[]): string {
    // 二进制转十六进制: 111111 (上九) -> 0 -> 乾
    // 0=阴, 1=阳
    const hexChars = '坤震坎艮巽离兑乾';
    let index = 0;
    for (let i = 0; i < 6; i++) {
      if (binaryLines[i] === '1') index += Math.pow(2, 5 - i);
    }
    return hexChars[index];
  }

  // 获取爻描述
  private getYaoDescription(yao: string): string {
    const map: Record<string, string> = {
      '6': '老阴 - 动则变，事物向反面转化',
      '7': '少阳 - 事物处于发展态势，积极行动',
      '8': '少阴 - 事物处于稳定状态，适宜坚守',
      '9': '老阳 - 极则变，把握变革时机',
    };
    return map[yao] ?? '平和之爻';
  }

  // 分析形势
  private analyzeSituation(original: string, changed: string): string {
    if (original === changed) {
      return '当前处于稳定状态，暂无重大变化，需静待时机。';
    }
    return `从 ${this.hexagrams[original]?.name ?? original} 转化为 ${this.hexagrams[changed]?.name ?? changed}，暗示事态正在发生转变。`;
  }

  // 获取注意事项
  private getCaution(original: string, changed: string): string {
    const cautions: Record<string, string> = {
      '讼': '避免与人争执，诉讼之事需慎重',
      '遯': '退避不是逃避，是蓄势待发',
      '明夷': '此时宜韬光养晦，不可锋芒毕露',
      '困': '坚守正道，耐心等待转机',
      '剥': '防止损失扩大，保护根本为上',
    };
    return cautions[original] ?? '顺势而为，切勿强求';
  }

  // 生成建议
  private generateRecommendations(original: string, changed: string, category?: DivinationCategory): string[] {
    const recommendations: string[] = [];
    
    // 基于卦象的建议
    const hex = this.hexagrams[original];
    if (hex) {
      recommendations.push(hex.advice);
    }
    
    // 基于类别的建议
    if (category === 'career') {
      recommendations.push('宜主动表现，把握展示能力的机会');
      recommendations.push('可寻求贵人相助，职场人际关系很重要');
    } else if (category === 'love') {
      recommendations.push('真诚表达，勇敢迈出第一步');
      recommendations.push('注意倾听对方想法，沟通是关键');
    } else if (category === 'wealth') {
      recommendations.push('财运正在积累中，不宜冒险投资');
      recommendations.push('可适当理财，但需稳健为主');
    }
    
    // 基于变卦的建议
    if (original !== changed) {
      recommendations.push('事态有变，需灵活应对');
    }
    
    // 确保有 3 条建议
    while (recommendations.length < 3) {
      recommendations.push('保持积极心态，顺势而为');
    }
    
    return recommendations.slice(0, 3);
  }
}
