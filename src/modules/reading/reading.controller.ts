import { Body, Controller, Post } from '@nestjs/common';
import { ReadingService } from './reading.service';
import { CreateReadingDto } from './dto/create-reading.dto';

@Controller('readings')
export class ReadingController {
  constructor(private readonly readingService: ReadingService) {}

  @Post()
  async create(@Body() dto: CreateReadingDto) {
    return this.readingService.generate(dto);
  }
}

