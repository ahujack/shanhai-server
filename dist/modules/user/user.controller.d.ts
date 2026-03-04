import { UserService } from './user.service';
import type { CreateUserDto } from './user.service';
export declare class UserController {
    private readonly userService;
    constructor(userService: UserService);
    create(dto: CreateUserDto): import("./user.service").UserProfile;
    findAll(): import("./user.service").UserProfile[];
    findOne(id: string): import("./user.service").UserProfile;
    update(id: string, dto: Partial<CreateUserDto>): import("./user.service").UserProfile;
    delete(id: string): void;
}
