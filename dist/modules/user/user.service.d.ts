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
    avatar?: string;
    role: 'user' | 'admin';
    membership: 'free' | 'premium' | 'vip';
    createdAt: string;
    updatedAt: string;
}
export interface CreateUserDto {
    name: string;
    birthDate?: string;
    birthTime?: string;
    gender?: 'male' | 'female' | 'other';
    timezone?: string;
    location?: string;
}
export declare class UserService {
    private users;
    private verificationCodes;
    private phoneToUser;
    private emailToUser;
    private socialToUser;
    private readonly CODE_EXPIRE_TIME;
    create(dto: CreateUserDto): UserProfile;
    findAll(): UserProfile[];
    findOne(id: string): UserProfile;
    update(id: string, dto: Partial<CreateUserDto>): UserProfile;
    delete(id: string): void;
    storeCode(identifier: string, code: string): void;
    verifyCode(identifier: string, code: string): boolean;
    findOrCreateByIdentifier(identifier: string): UserProfile;
    findOrCreateBySocial(provider: 'google' | 'facebook', socialId: string): UserProfile;
    updateUserRole(userId: string, role: 'user' | 'admin'): UserProfile;
    updateUserMembership(userId: string, membership: 'free' | 'premium' | 'vip'): UserProfile;
}
