import { Meditation, MeditationService } from './meditation.service';
export declare class MeditationController {
    private readonly meditationService;
    constructor(meditationService: MeditationService);
    findAll(): Meditation[];
    findOne(id: string): Meditation | undefined;
}
