import { MailService } from '../mail/mail.service';
export interface UserProfile {
    id: string;
    name: string;
    birthDate?: string;
    birthTime?: string;
    gender?: 'male' | 'female' | 'other';
    timezone?: string;
    location?: string;
    phone?: string;
    email?: string;
    password?: string;
    avatar?: string;
    role: 'user' | 'admin';
    membership: 'free' | 'premium' | 'vip';
    createdAt: string;
    updatedAt: string;
}
export interface CreateUserDto {
    name: string;
    email?: string;
    birthDate?: string;
    birthTime?: string;
    gender?: 'male' | 'female' | 'other';
    timezone?: string;
    location?: string;
}
export declare class UserService {
    private mailService?;
    private users;
    private verificationCodes;
    private emailToUser;
    private socialToUser;
    private readonly CODE_EXPIRE_TIME;
    private readonly PASSWORD_SECRET;
    constructor(mailService?: MailService | undefined);
    hashPassword(password: string): string;
    verifyPassword(password: string, hashedPassword: string): boolean;
    isEmailRegistered(email: string): boolean;
    registerWithEmail(email: string, password: string, name: string): UserProfile;
    loginWithPassword(email: string, password: string): UserProfile | null;
    create(dto: CreateUserDto): UserProfile;
    findAll(): UserProfile[];
    findOne(id: string): UserProfile;
    update(id: string, dto: Partial<CreateUserDto>): UserProfile;
    delete(id: string): void;
    storeCode(identifier: string, code: string): void;
    verifyCode(identifier: string, code: string): boolean;
    findOrCreateByEmail(email: string): UserProfile;
    findOrCreateBySocial(provider: 'google' | 'facebook', socialId: string, userInfo?: {
        email?: string;
        name?: string;
    }): UserProfile;
    updateUserRole(userId: string, role: 'user' | 'admin'): UserProfile;
    updateUserMembership(userId: string, membership: 'free' | 'premium' | 'vip'): UserProfile;
}
