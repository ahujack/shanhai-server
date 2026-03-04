export type PersonaId = 'elder' | 'youth' | 'oracle';
export interface PersonaSchema {
    id: PersonaId;
    name: string;
    title: string;
    toneTags: string[];
    description: string;
    greeting: string;
    image: string;
}
export declare class PersonaService {
    findAll(): PersonaSchema[];
    findOne(id: PersonaId): PersonaSchema;
}
