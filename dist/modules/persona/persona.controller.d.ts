import { PersonaService } from './persona.service';
export declare class PersonaController {
    private readonly personaService;
    constructor(personaService: PersonaService);
    findAll(): import("./persona.service").PersonaSchema[];
    findOne(id: string): import("./persona.service").PersonaSchema;
}
