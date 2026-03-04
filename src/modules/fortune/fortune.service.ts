import { Injectable } from '@nestjs/common';

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

@Injectable()
export class FortuneService {
  private lastUserId: string | null = null;
  private lastDate: string | null = null;
  private cachedSlip: FortuneSlip | null = null;

  // 获取今日运势
  getDailyFortune(userId?: string): FortuneSlip {
    const today = new Date().toISOString().split('T')[0];
    
    // 同一用户同一天返回相同签
    if (this.lastUserId === userId && this.lastDate === today && this.cachedSlip) {
      return this.cachedSlip;
    }
    
    // 根据日期和用户ID生成一致的签
    const seed = userId 
      ? userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + new Date().getDate()
      : new Date().getDate();
    
    const index = seed % fortuneSlips.length;
    const slip = fortuneSlips[index];
    
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
  drawRandomSlip(): FortuneSlip {
    const index = Math.floor(Math.random() * fortuneSlips.length);
    return fortuneSlips[index];
  }
}
