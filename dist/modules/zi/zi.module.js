"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZiModule = void 0;
const common_1 = require("@nestjs/common");
const zi_service_1 = require("./zi.service");
const zi_controller_1 = require("./zi.controller");
const ocr_service_1 = require("../ocr/ocr.service");
let ZiModule = class ZiModule {
};
exports.ZiModule = ZiModule;
exports.ZiModule = ZiModule = __decorate([
    (0, common_1.Module)({
        controllers: [zi_controller_1.ZiController],
        providers: [zi_service_1.ZiService, ocr_service_1.OcrService],
        exports: [zi_service_1.ZiService],
    })
], ZiModule);
//# sourceMappingURL=zi.module.js.map