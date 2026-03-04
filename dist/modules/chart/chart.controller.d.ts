import { ChartService } from './chart.service';
import { UserService } from '../user/user.service';
export declare class ChartController {
    private readonly chartService;
    private readonly userService;
    constructor(chartService: ChartService, userService: UserService);
    generate(userId: string, body: {
        gender: 'male' | 'female';
    }): Promise<import("./chart.service").BaziChart>;
    findOne(userId: string): {
        message: string;
        hasChart: boolean;
        chart?: undefined;
    } | {
        hasChart: boolean;
        chart: import("./chart.service").BaziChart;
        message?: undefined;
    };
}
