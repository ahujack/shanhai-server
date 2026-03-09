"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const user_controller_1 = require("./user.controller");
const auth_controller_1 = require("./auth.controller");
const user_service_1 = require("./user.service");
const mail_module_1 = require("../mail/mail.module");
const points_module_1 = require("../points/points.module");
const achievement_module_1 = require("../achievement/achievement.module");
let UserModule = class UserModule {
};
exports.UserModule = UserModule;
exports.UserModule = UserModule = __decorate([
    (0, common_1.Module)({
        imports: [
            jwt_1.JwtModule.register({
                global: true,
                secret: process.env.JWT_SECRET || 'shanhai-secret-key-change-in-production',
                signOptions: { expiresIn: '7d' },
            }),
            mail_module_1.MailModule,
            (0, common_1.forwardRef)(() => points_module_1.PointsModule),
            (0, common_1.forwardRef)(() => achievement_module_1.AchievementModule),
        ],
        controllers: [user_controller_1.UserController, auth_controller_1.AuthController],
        providers: [user_service_1.UserService],
        exports: [user_service_1.UserService],
    })
], UserModule);
//# sourceMappingURL=user.module.js.map