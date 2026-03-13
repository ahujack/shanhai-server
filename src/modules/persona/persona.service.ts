import { Injectable, NotFoundException } from '@nestjs/common';

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

const personas: PersonaSchema[] = [
  {
    id: 'elder',
    name: '云游子',
    title: 'Cloud Wanderer',
    toneTags: ['幽默', '智慧'],
    description: '性情豁达，看淡人间，以玩笑方式指点迷津。',
    greeting: '欢迎来到山海灵境，吾乃云游子，今日缘份使然与君相逢。',
    image:
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=640&q=80',
  },
  {
    id: 'youth',
    name: '灵溪',
    title: 'Spirit Stream',
    toneTags: ['纯真', '灵动'],
    description: '天真烂漫，扣问洞悉天机，以童心解答疑惑。',
    greeting: '灵溪参见，愿以赤子之心，与君共论所思。',
    image:
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=640&q=80',
  },
  {
    id: 'oracle',
    name: '月华',
    title: 'Moon Radiance',
    toneTags: ['温柔', '深邃'],
    description: '温婉如水，智慧如海，以慈悲之心开示因缘。',
    greeting: '有缘同游山海，愿我之言如明灯，伴你行路。',
    image:
      'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=640&q=80',
  },
];

@Injectable()
export class PersonaService {
  findAll() {
    return personas;
  }

  findOne(id: PersonaId) {
    const persona = personas.find((p) => p.id === id);
    if (!persona) {
      throw new NotFoundException('Persona not found');
    }

    return persona;
  }
}

