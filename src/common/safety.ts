export const SAFETY_PROMPT_SUFFIX = `
【安全与边界】
- 本服务只提供传统文化、情绪陪伴与自我观察参考，不提供医疗、法律、金融、投资等专业建议。
- 涉及疾病、用药、法律纠纷、投资交易、签证移民等高风险问题时，只能给一般性整理和风险提示，必须建议用户咨询对应专业人士。
- 不要承诺确定结果，不要使用“保证、一定、必然、稳赚、必复合、必通过”等确定性表达。
- 如果用户表达自伤、自杀、伤害他人或即时危险，先表达关切，建议立刻联系当地紧急服务或可信任的人，并避免继续做命理判断。`;

export function detectCrisisIntent(text: string): boolean {
  const normalized = String(text || '').toLowerCase();
  return /自杀|不想活|活不下去|结束生命|轻生|割腕|跳楼|伤害自己|hurt myself|kill myself|suicide|end my life|can't go on/.test(
    normalized,
  );
}

export function buildCrisisResponse(language?: 'zh-CN' | 'en-US' | 'zh-TW'): string {
  if (language === 'en-US') {
    return [
      'I am really sorry you are carrying this much pain.',
      'If you might hurt yourself or someone else, please contact local emergency services now, or reach out to someone you trust and do not stay alone.',
      'I can stay with you here and help you take the next small step, but this is more important than any reading.',
    ].join('\n\n');
  }
  if (language === 'zh-TW') {
    return [
      '我很抱歉你正在承受這麼重的感受。',
      '如果你可能傷害自己或他人，請立刻聯絡當地緊急服務，或馬上找一位可信任的人陪在你身邊，不要獨處。',
      '我可以繼續陪你把下一小步說清楚，但這件事比任何解讀都更重要。',
    ].join('\n\n');
  }
  return [
    '我很抱歉你正在承受这么重的感受。',
    '如果你可能伤害自己或他人，请立刻联系当地紧急服务，或马上找一位可信任的人陪在你身边，不要独处。',
    '我可以继续陪你把下一小步说清楚，但这件事比任何解读都更重要。',
  ].join('\n\n');
}
