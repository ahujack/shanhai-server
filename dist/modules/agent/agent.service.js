"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var AgentService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const persona_service_1 = require("../persona/persona.service");
const reading_service_1 = require("../reading/reading.service");
const fortune_service_1 = require("../fortune/fortune.service");
const chart_service_1 = require("../chart/chart.service");
const zi_service_1 = require("../zi/zi.service");
let AgentService = AgentService_1 = class AgentService {
    personaService;
    readingService;
    fortuneService;
    chartService;
    ziService;
    constructor(personaService, readingService, fortuneService, chartService, ziService) {
        this.personaService = personaService;
        this.readingService = readingService;
        this.fortuneService = fortuneService;
        this.chartService = chartService;
        this.ziService = ziService;
    }
    async handleChat(dto) {
        const persona = this.resolvePersona(dto.personaId);
        const userChart = dto.userId ? this.chartService.findOne(dto.userId) : null;
        const { intent, category, mood } = await this.classifyWithDeepSeek(dto, persona, userChart);
        const actions = [];
        let artifacts = {};
        const divinationCategory = category === 'emotion' ? 'love' : category;
        if (intent === 'divination') {
            const reading = await this.readingService.generate({
                question: dto.message,
                category: category || divinationCategory || this.inferCategory(dto.message),
                userId: dto.userId,
            });
            artifacts = { reading };
            actions.push({
                type: 'view_reading',
                label: '查看完整解读',
            });
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
        if (intent === 'zi') {
            const ziChar = this.extractZiFromMessage(dto.message);
            if (ziChar) {
                const ziResult = await this.ziService.analyze(ziChar);
                artifacts = { zi: ziResult };
                actions.push({
                    type: 'view_zi',
                    label: '查看测字详情',
                });
            }
        }
        const reply = this.composeReply(persona, intent, dto.message, artifacts, userChart);
        return {
            persona: persona.id,
            intent,
            reply,
            actions,
            artifacts,
            hasChart: !!userChart,
        };
    }
    extractZiFromMessage(message) {
        const match = message.match(/[\u4e00-\u9fa5]/);
        return match ? match[0] : null;
    }
    async classifyWithDeepSeek(dto, persona, userChart) {
        const apiKey = process.env.DEEPSEEK_API_KEY;
        const model = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat';
        if (!apiKey) {
            common_1.Logger.warn('DEEPSEEK_API_KEY 未配置，回退到本地规则意图识别', AgentService_1.name);
            const fallbackIntent = this.fallbackDetectIntent(dto.message, userChart);
            return { intent: fallbackIntent };
        }
        try {
            const contextInfo = userChart
                ? `\n用户八字：${userChart.yearGanZhi}年 ${userChart.monthGanZhi}月 ${userChart.dayGanZhi}日 ${userChart.hourGanZhi}时`
                : '\n用户尚未建立命盘';
            const response = await axios_1.default.post(process.env.DEEPSEEK_API_URL ?? 'https://api.deepseek.com/chat/completions', {
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
                    {
                        role: 'user',
                        content: JSON.stringify({
                            message: dto.message,
                            mood: dto.mood,
                            persona: { id: persona.id, name: persona.name },
                            hasChart: !!userChart,
                        }),
                    },
                ],
            }, {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
            });
            const raw = response.data?.choices?.[0]?.message?.content ?? '{}';
            const parsed = JSON.parse(raw);
            const validIntents = ['chat', 'divination', 'meditation', 'chart', 'fortune', 'zi'];
            const intent = validIntents.includes(parsed.intent) ? parsed.intent : 'chat';
            return {
                intent,
                category: parsed.category,
                mood: parsed.mood,
            };
        }
        catch (error) {
            common_1.Logger.error('DeepSeek 意图识别失败，使用本地规则回退', error.message, AgentService_1.name);
            const intent = this.fallbackDetectIntent(dto.message, userChart);
            return { intent };
        }
    }
    fallbackDetectIntent(message, userChart) {
        const text = message.toLowerCase();
        const chartKeywords = ['命盘', '八字', '我的命', '排盘', '紫微', '五行', '日主', '强弱'];
        const fortuneKeywords = ['今日运势', '今天运气', '抽签', '日签', '运气'];
        const divinationKeywords = ['占卜', '解读', '卦', '算一算', '问卜', '决定'];
        const meditationKeywords = ['焦虑', '冥想', '睡不着', '平静', '紧张', '失眠', '静心'];
        const ziKeywords = ['测字', '写字', '看字', '这个字', '字怎么样', '字的意思', '帮我看看'];
        const hasChinese = /[\u4e00-\u9fa5]/.test(message);
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
        if (ziKeywords.some(word => text.includes(word)) || (hasChinese && message.length <= 10)) {
            return 'zi';
        }
        return 'chat';
    }
    inferCategory(message) {
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
    resolvePersona(personaId) {
        if (!personaId) {
            return this.personaService.findAll()[0];
        }
        return this.personaService.findOne(personaId);
    }
    buildMeditation(dto) {
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
    composeReply(persona, intent, message, artifacts, userChart) {
        if (intent === 'zi' && artifacts.zi) {
            const zi = artifacts.zi;
            const coldRead = zi.coldReadings[0];
            const advice = zi.interpretation.advice[0];
            return `${persona.name}：${coldRead}\n\n🔍 拆解："${zi.zi.zi}"字\n📦 部件：${zi.zi.components.join(' + ')}\n💡 联想：${zi.zi.associativeMeaning}\n\n📋 建议：${advice}\n\n${zi.handwriting.stabilityInterpretation}\n\n点击「查看测字详情」可获得完整分析。`;
        }
        if (intent === 'divination' && artifacts.reading) {
            const reading = artifacts.reading;
            return `${persona.name}：你的问题我已感知。\n\n🙏 所得卦象：${reading.hexagram.originalName}\n📖 解读：${reading.interpretation.overall}\n\n${persona.name}建议你：${reading.recommendations[0]}\n\n若想查看完整解读，可点击下方按钮。`;
        }
        if (intent === 'meditation') {
            return `${persona.name}：我感受到你内心的不静。\n\n让我们一起做几次深呼吸，放下那些困扰你的事情。\n\n我为你准备了一段冥想引导，点击下方「开始冥想」即可。`;
        }
        if (intent === 'fortune' && artifacts.fortune) {
            const fortune = artifacts.fortune;
            return `${persona.name}：今日与你有缘。\n\n✨ 今日签诗：${fortune.poem.title}\n💫 运势：${fortune.day}\n\n幸运数字：${fortune.lucky.number} | 幸运颜色：${fortune.lucky.color}\n\n${persona.name}：${fortune.advice[0]}`;
        }
        if (intent === 'chart') {
            if (userChart) {
                return `${persona.name}：你的命盘已在此。\n\n🔮 八字：${userChart.dayGanZhi}（日主）\n🌟 五行：木${userChart.wuxingStrength.wood}% 火${userChart.wuxingStrength.fire}% 土${userChart.wuxingStrength.earth}% 金${userChart.wuxingStrength.metal}% 水${userChart.wuxingStrength.water}%\n\n📝 性格特点：${userChart.personalityTraits.slice(0, 2).join('、')}\n\n💼 事业：${userChart.fortuneSummary.career}\n💕 感情：${userChart.fortuneSummary.love}`;
            }
            else {
                return `${persona.name}：你还没有建立命盘呢。\n\n若想了解自己的八字命盘，可以先去「我的」页面输入出生信息，我会为你生成专属命盘分析。`;
            }
        }
        if (userChart && intent === 'chat') {
            const wxKey = Object.entries(userChart.wuxingStrength)
                .sort((a, b) => b[1] - a[1])[0];
            const wxNames = {
                wood: '木', fire: '火', earth: '土', metal: '金', water: '水'
            };
            return `${persona.name}：我听到了你的心绪。\n\n从你的八字来看，你的${wxNames[wxKey[0]]}性较强，或许可以尝试从这个角度来调整自己的状态。\n\n若想更进一步，可告诉我需要抽签、静坐还是查看命盘，我都在。`;
        }
        return `${persona.name}：我听到了你的心绪。若想更进一步，可告诉我需要抽签、静坐还是查看命盘，我都在。`;
    }
};
exports.AgentService = AgentService;
exports.AgentService = AgentService = AgentService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [persona_service_1.PersonaService,
        reading_service_1.ReadingService,
        fortune_service_1.FortuneService,
        chart_service_1.ChartService,
        zi_service_1.ZiService])
], AgentService);
//# sourceMappingURL=agent.service.js.map