export type DivinationCategory = 'career' | 'love' | 'wealth' | 'health' | 'growth' | 'general';
export declare class CreateReadingDto {
    question: string;
    category?: DivinationCategory;
    keywords?: string[];
    userId?: string;
}
