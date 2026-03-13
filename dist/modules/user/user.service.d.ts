import { PrismaService } from '../../prisma.service';
import { MailService } from '../mail/mail.service';
import { PointsService } from '../points/points.service';
import { AchievementService } from '../achievement/achievement.service';
export interface UserProfile {
    id: string;
    name: string;
    birthDate?: string;
    birthTime?: string;
    gender?: 'male' | 'female' | 'other';
    timezone?: string;
    location?: string;
    focusGod?: string;
    phone?: string;
    email?: string;
    password?: string;
    avatar?: string;
    role: 'user' | 'admin';
    membership: 'free' | 'premium' | 'vip';
    googleId?: string;
    facebookId?: string;
    referralCode?: string;
    referredBy?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface CreateUserDto {
    name: string;
    email?: string;
    birthDate?: string;
    birthTime?: string;
    gender?: 'male' | 'female' | 'other';
    timezone?: string;
    location?: string;
    focusGod?: string;
}
export declare class UserService {
    private prisma;
    private mailService?;
    private pointsService?;
    private achievementService?;
    private verificationCodes;
    private readonly traditionalAvatars;
    private readonly CODE_EXPIRE_TIME;
    private readonly BCRYPT_ROUNDS;
    constructor(prisma: PrismaService, mailService?: MailService | undefined, pointsService?: PointsService | undefined, achievementService?: AchievementService | undefined);
    hashPassword(password: string): Promise<string>;
    verifyPassword(password: string, hashedPassword: string): Promise<boolean>;
    isEmailRegistered(email: string): Promise<boolean>;
    registerWithEmail(email: string, password: string, name: string, referralCode?: string): Promise<UserProfile>;
    loginWithPassword(email: string, password: string): Promise<UserProfile | null>;
    resetPassword(email: string, newPassword: string): Promise<UserProfile>;
    create(dto: CreateUserDto): Promise<UserProfile>;
    findAll(): Promise<UserProfile[]>;
    findOne(id: string): Promise<UserProfile>;
    update(id: string, dto: Partial<CreateUserDto>): Promise<UserProfile>;
    delete(id: string): Promise<void>;
    private getRandomAvatar;
    storeCode(identifier: string, code: string): void;
    verifyCode(identifier: string, code: string): boolean;
    findOrCreateByEmail(email: string): Promise<UserProfile>;
    findOrCreateBySocial(provider: 'google' | 'facebook', socialId: string, userInfo?: {
        email?: string;
        name?: string;
    }): Promise<UserProfile>;
    updateUserRole(userId: string, role: 'user' | 'admin'): Promise<UserProfile>;
    updateUserMembership(userId: string, membership: 'free' | 'premium' | 'vip'): Promise<UserProfile>;
    private formatUser;
}
