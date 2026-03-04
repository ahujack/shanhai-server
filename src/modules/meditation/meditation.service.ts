import { Injectable } from '@nestjs/common';

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

@Injectable()
export class MeditationService {
  private meditations: Meditation[] = [
    {
      id: '1',
      title: '山海静心',
      description: '在山海世界中寻找内心的宁静',
      durationMinutes: 5,
      category: 'calm',
      steps: [
        {
          order: 1,
          title: '准备',
          description: '找一个舒适的坐姿，轻轻闭上眼睛',
          durationSeconds: 30,
        },
        {
          order: 2,
          title: '呼吸',
          description: '缓慢而深长地呼吸三次，感受每一次吸气',
          durationSeconds: 45,
        },
        {
          order: 3,
          title: '想象',
          description: '想象自己置身于云雾缭绕的山巅，脚下是绵延的山脉',
          durationSeconds: 60,
        },
        {
          order: 4,
          title: '倾听',
          description: '远处传来悠扬的古琴声，伴随着松涛和鸟鸣',
          durationSeconds: 60,
        },
        {
          order: 5,
          title: '回归',
          description: '缓缓睁开眼睛，回到当下',
          durationSeconds: 30,
        },
      ],
    },
    {
      id: '2',
      title: '梦境助眠',
      description: '引导你进入宁静的梦乡',
      durationMinutes: 15,
      category: 'sleep',
      steps: [
        {
          order: 1,
          title: '放松身体',
          description: '从脚趾开始，逐渐放松身体的每一个部位',
          durationSeconds: 60,
        },
        {
          order: 2,
          title: '数呼吸',
          description: '缓慢数着呼吸，从1数到10，重复',
          durationSeconds: 120,
        },
        {
          order: 3,
          title: '夜晚场景',
          description: '想象自己躺在草地上，仰观星空，星光柔和而宁静',
          durationSeconds: 120,
        },
        {
          order: 4,
          title: '进入梦乡',
          description: '让自己的身体逐渐沉重，放松，融入这片星空',
          durationSeconds: 120,
        },
      ],
    },
    {
      id: '3',
      title: '焦虑缓解',
      description: '释放压力，舒缓焦虑情绪',
      durationMinutes: 8,
      category: 'anxiety',
      steps: [
        {
          order: 1,
          title: '觉察',
          description: '注意自己的呼吸，意识到当下的存在',
          durationSeconds: 30,
        },
        {
          order: 2,
          title: '命名情绪',
          description: '把焦虑当作一个存在，邀请它坐下来',
          durationSeconds: 45,
        },
        {
          order: 3,
          title: '身体扫描',
          description: '从头顶开始，逐渐扫描全身，感受每个部位的状态',
          durationSeconds: 120,
        },
        {
          order: 4,
          title: '呼气释放',
          description: '每次呼气时，想象焦虑随着呼气离开身体',
          durationSeconds: 120,
        },
        {
          order: 5,
          title: '自我接纳',
          description: '告诉自己：此刻的我，已经足够好',
          durationSeconds: 60,
        },
      ],
    },
  ];

  findAll(): Meditation[] {
    return this.meditations;
  }

  findOne(id: string): Meditation | undefined {
    return this.meditations.find(m => m.id === id);
  }

  findByCategory(category: Meditation['category']): Meditation[] {
    return this.meditations.filter(m => m.category === category);
  }
}
