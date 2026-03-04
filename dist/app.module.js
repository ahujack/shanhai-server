"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const health_module_1 = require("./modules/health/health.module");
const persona_module_1 = require("./modules/persona/persona.module");
const reading_module_1 = require("./modules/reading/reading.module");
const agent_module_1 = require("./modules/agent/agent.module");
const user_module_1 = require("./modules/user/user.module");
const chart_module_1 = require("./modules/chart/chart.module");
const fortune_module_1 = require("./modules/fortune/fortune.module");
const meditation_module_1 = require("./modules/meditation/meditation.module");
const zi_module_1 = require("./modules/zi/zi.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            health_module_1.HealthModule,
            persona_module_1.PersonaModule,
            reading_module_1.ReadingModule,
            agent_module_1.AgentModule,
            user_module_1.UserModule,
            chart_module_1.ChartModule,
            fortune_module_1.FortuneModule,
            meditation_module_1.MeditationModule,
            zi_module_1.ZiModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map