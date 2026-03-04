"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChartService = void 0;
const common_1 = require("@nestjs/common");
let ChartService = class ChartService {
    charts = new Map();
    gan = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
    zhi = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
    async generateChart(userId, birthDate, birthTime, gender) {
        const date = new Date(birthDate);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const [hour, minute] = birthTime.split(':').map(Number);
        const yearGZ = this.calculateYearGanZhi(year);
        const monthGZ = this.calculateMonthGanZhi(year, month);
        const dayGZ = this.calculateDayGanZhi(year, month, day);
        const hourGZ = this.calculateHourGanZhi(dayGZ, hour);
        const dayMaster = dayGZ.charAt(0);
        const wuxingStrength = this.calculateWuxingStrength(yearGZ, monthGZ, dayGZ, hourGZ);
        const personalityTraits = this.analyzePersonality(dayMaster, wuxingStrength);
        const fortuneSummary = this.analyzeFortune(dayMaster, wuxingStrength, gender);
        const suggestions = this.generateSuggestions(dayMaster, wuxingStrength);
        const chart = {
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
            wuxingStrength: wuxingStrength,
            personalityTraits,
            fortuneSummary,
            suggestions,
        };
        this.charts.set(userId, chart);
        return chart;
    }
    findOne(userId) {
        return this.charts.get(userId) ?? null;
    }
    calculateYearGanZhi(year) {
        const ganIndex = (year - 4) % 10;
        const zhiIndex = (year - 4) % 12;
        return this.gan[ganIndex] + this.zhi[zhiIndex];
    }
    calculateMonthGanZhi(year, month) {
        const yearGanIndex = (year - 4) % 10;
        const monthGanIndex = (yearGanIndex * 2 + month) % 10;
        const monthZhiIndex = (month + 1) % 12;
        return this.gan[monthGanIndex] + this.zhi[monthZhiIndex];
    }
    calculateDayGanZhi(year, month, day) {
        const baseDate = new Date(1900, 0, 1);
        const targetDate = new Date(year, month - 1, day);
        const days = Math.floor((targetDate.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
        const ganIndex = (days + 50) % 10;
        const zhiIndex = (days + 56) % 12;
        return this.gan[ganIndex] + this.zhi[zhiIndex];
    }
    calculateHourGanZhi(dayGZ, hour) {
        const dayGan = dayGZ.charAt(0);
        const dayGanIndex = this.gan.indexOf(dayGan);
        const hourZhiIndex = Math.floor((hour + 1) / 2) % 12;
        const hourGanIndex = (dayGanIndex * 2 + hourZhiIndex) % 10;
        return this.gan[hourGanIndex] + this.zhi[hourZhiIndex];
    }
    getSunSign(month, day) {
        const suns = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
        const solarTerms = [20, 19, 21, 21, 21, 21, 23, 23, 23, 23, 22, 22];
        const idx = month - 1;
        return day < solarTerms[idx] ? suns[(idx + 11) % 12] : suns[idx];
    }
    getMoonSign(month) {
        const moons = ['朔月', '峨眉月', '上弦月', '盈凸月', '满月', '亏凸月', '下弦月', '残月'];
        const day = new Date().getDate();
        const phase = Math.floor((day - 1) / 4) % 8;
        return moons[phase];
    }
    calculateWuxingStrength(yearGZ, monthGZ, dayGZ, hourGZ) {
        const wuxing = {
            wood: ['甲', '乙'],
            fire: ['丙', '丁'],
            earth: ['戊', '己'],
            metal: ['庚', '辛'],
            water: ['壬', '癸'],
        };
        const zhiWuxing = {
            '寅': 'wood', '卯': 'wood',
            '巳': 'fire', '午': 'fire',
            '辰': 'earth', '丑': 'earth', '未': 'earth', '戌': 'earth',
            '申': 'metal', '酉': 'metal',
            '子': 'water', '亥': 'water',
        };
        const allGZ = yearGZ + monthGZ + dayGZ + hourGZ;
        const strength = { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 };
        for (const char of allGZ) {
            for (const [wx, chars] of Object.entries(wuxing)) {
                if (chars.includes(char)) {
                    strength[wx]++;
                }
            }
            if (zhiWuxing[char]) {
                strength[zhiWuxing[char]]++;
            }
        }
        const total = Object.values(strength).reduce((a, b) => a + b, 0);
        for (const key of Object.keys(strength)) {
            strength[key] = Math.round((strength[key] / total) * 100);
        }
        return strength;
    }
    analyzePersonality(dayMaster, wuxing) {
        const traits = [];
        const dayMasterWuxing = {
            '甲': 'wood', '乙': 'wood',
            '丙': 'fire', '丁': 'fire',
            '戊': 'earth', '己': 'earth',
            '庚': 'metal', '辛': 'metal',
            '壬': 'water', '癸': 'water',
        };
        const wx = dayMasterWuxing[dayMaster];
        const personalityMap = {
            wood: ['富有生', '仁慈', '乐观', '喜欢新事物'],
            fire: ['热情', '积极', '有活力', '执行力强'],
            earth: ['稳重', '务实', '诚信', '有耐心'],
            metal: ['果断', '正义', '有原则', '事业心强'],
            water: ['智慧', '灵活', '善于沟通', '适应力强'],
        };
        traits.push(...personalityMap[wx] || []);
        const maxWx = Object.entries(wuxing).reduce((a, b) => a[1] > b[1] ? a : b)[0];
        const minWx = Object.entries(wuxing).reduce((a, b) => a[1] < b[1] ? a : b)[0];
        if (wuxing[wx] >= 30) {
            traits.push(`${wx}性偏旺，有领导气质`);
        }
        else if (wuxing[wx] <= 15) {
            traits.push(`${wx}性偏弱，需要更多滋养`);
        }
        return traits;
    }
    analyzeFortune(dayMaster, wuxing, gender) {
        const dayMasterWuxing = {
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
                const healthMap = {
                    wood: '注意肝胆', fire: '注意心脏', earth: '注意脾胃',
                    metal: '注意肺部', water: '注意肾部'
                };
                return healthMap[w];
            }
            return null;
        }).filter(Boolean).join('、') || '整体健康良好';
        return { career, wealth, love, health };
    }
    generateSuggestions(dayMaster, wuxing) {
        const suggestions = [];
        const dayMasterWuxing = {
            '甲': 'wood', '乙': 'wood', '丙': 'fire', '丁': 'fire',
            '戊': 'earth', '己': 'earth', '庚': 'metal', '辛': 'metal',
            '壬': 'water', '癸': 'water',
        };
        const wx = dayMasterWuxing[dayMaster];
        const favorWx = Object.entries(wuxing)
            .filter(([k, v]) => v >= 20 && k !== wx)
            .sort((a, b) => b[1] - a[1])[0];
        if (favorWx) {
            suggestions.push(`宜加强${favorWx[0]}的能量，可通过服饰、颜色或环境布局调整`);
        }
        const careerMap = {
            wood: '教育、文化、艺术、新媒体',
            fire: '能源、互联网、餐饮、娱乐',
            earth: '房地产、建筑、农业、珠宝',
            metal: '金融、法律、珠宝、机械',
            water: '物流、旅游、贸易、咨询',
        };
        suggestions.push(`适合职业方向：${careerMap[wx]}`);
        const healthMap = {
            wood: '保持充足睡眠，适度运动',
            fire: '清淡饮食，避免过度兴奋',
            earth: '规律饮食，注意脾胃调养',
            metal: '注意呼吸系统，适当锻炼',
            water: '保持温暖，适度补水',
        };
        suggestions.push(`养生重点：${healthMap[wx]}`);
        return suggestions;
    }
};
exports.ChartService = ChartService;
exports.ChartService = ChartService = __decorate([
    (0, common_1.Injectable)()
], ChartService);
//# sourceMappingURL=chart.service.js.map