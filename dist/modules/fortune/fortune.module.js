"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FortuneModule = void 0;
const common_1 = require("@nestjs/common");
const fortune_service_1 = require("./fortune.service");
const fortune_controller_1 = require("./fortune.controller");
let FortuneModule = class FortuneModule {
};
exports.FortuneModule = FortuneModule;
exports.FortuneModule = FortuneModule = __decorate([
    (0, common_1.Module)({
        controllers: [fortune_controller_1.FortuneController],
        providers: [fortune_service_1.FortuneService],
        exports: [fortune_service_1.FortuneService],
    })
], FortuneModule);
//# sourceMappingURL=fortune.module.js.map