export interface Meditation {
    id: string;
    title: string;
    description: string;
    durationMinutes: number;
    category: 'calm' | 'sleep' | 'anxiety' | 'focus';
    steps: MeditationStep[];
}
export interface MeditationStep {
    order: number;
    title: string;
    description: string;
    durationSeconds: number;
}
export declare class MeditationService {
    private meditations;
    findAll(): Meditation[];
    findOne(id: string): Meditation | undefined;
    findByCategory(category: Meditation['category']): Meditation[];
}
