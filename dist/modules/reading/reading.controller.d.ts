import { ReadingService } from './reading.service';
import { CreateReadingDto } from './dto/create-reading.dto';
export declare class ReadingController {
    private readonly readingService;
    private prisma;
    constructor(readingService: ReadingService);
    create(dto: CreateReadingDto): Promise<import("./reading.service").DivinationResult>;
}
