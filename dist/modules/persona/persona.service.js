"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PersonaService = void 0;
const common_1 = require("@nestjs/common");
const personas = [
    {
        id: 'elder',
        name: '老顽童',
        title: 'Elder Trickster',
        toneTags: ['幽默', '智慧'],
        description: '性情豁达，看淡人间，以玩笑方式指点迷津。',
        greeting: '欢迎来到山海灵境，吾乃老顽童，今日缘份使然与君相逢。',
        image: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=640&q=80',
    },
    {
        id: 'youth',
        name: '小道士',
        title: 'Young Taoist',
        toneTags: ['纯真', '灵动'],
        description: '天真烂漫，扣问洞悉天机，以童心解答疑惑。',
        greeting: '小道士参见，愿以赤子之心，与君共论所思。',
        image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=640&q=80',
    },
    {
        id: 'oracle',
        name: '女道士',
        title: 'Female Oracle',
        toneTags: ['温柔', '深邃'],
        description: '温婉如水，智慧如海，以慈悲之心开示因缘。',
        greeting: '有缘同游山海，愿我之言如明灯，伴你行路。',
        image: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=640&q=80',
    },
];
let PersonaService = class PersonaService {
    findAll() {
        return personas;
    }
    findOne(id) {
        const persona = personas.find((p) => p.id === id);
        if (!persona) {
            throw new common_1.NotFoundException('Persona not found');
        }
        return persona;
    }
};
exports.PersonaService = PersonaService;
exports.PersonaService = PersonaService = __decorate([
    (0, common_1.Injectable)()
], PersonaService);
//# sourceMappingURL=persona.service.js.map