import { Injectable } from '@nestjs/common';
import { Controller, Get, Param } from '@nestjs/common';
import { Meditation, MeditationService } from './meditation.service';

@Controller('meditations')
export class MeditationController {
  constructor(private readonly meditationService: MeditationService) {}

  @Get()
  findAll(): Meditation[] {
    return this.meditationService.findAll();
  }

  @Get(':id')
  findOne(id: string): Meditation | undefined {
    return this.meditationService.findOne(id);
  }
}
