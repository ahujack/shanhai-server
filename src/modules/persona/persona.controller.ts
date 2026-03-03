import { Controller, Get, Param } from '@nestjs/common';
import { PersonaService, PersonaId } from './persona.service';

@Controller('personas')
export class PersonaController {
  constructor(private readonly personaService: PersonaService) {}

  @Get()
  findAll() {
    return this.personaService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.personaService.findOne(id as PersonaId);
  }
}

