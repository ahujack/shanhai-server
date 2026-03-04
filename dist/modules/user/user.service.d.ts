export interface UserProfile {
    id: string;
    name: string;
    birthDate: string;
    birthTime: string;
    gender: 'male' | 'female' | 'other';
    timezone: string;
    location?: string;
    createdAt: string;
    updatedAt: string;
}
export interface CreateUserDto {
    name: string;
    birthDate: string;
    birthTime: string;
    gender: 'male' | 'female' | 'other';
    timezone?: string;
    location?: string;
}
export declare class UserService {
    private users;
    create(dto: CreateUserDto): UserProfile;
    findAll(): UserProfile[];
    findOne(id: string): UserProfile;
    update(id: string, dto: Partial<CreateUserDto>): UserProfile;
    delete(id: string): void;
}
