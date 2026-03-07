import { UserService } from './user.service';
import type { CreateUserDto } from './user.service';
export declare class UserController {
    private readonly userService;
    constructor(userService: UserService);
    create(dto: CreateUserDto): Promise<import("./user.service").UserProfile>;
    findAll(): Promise<import("./user.service").UserProfile[]>;
    findOne(id: string): Promise<import("./user.service").UserProfile>;
    update(id: string, dto: Partial<CreateUserDto>): Promise<import("./user.service").UserProfile>;
    delete(id: string): Promise<void>;
}
