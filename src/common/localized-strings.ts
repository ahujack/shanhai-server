import { AppLanguage } from './app-language';

export type LocalizedTriple = {
  zhCN: string;
  enUS: string;
  zhTW: string;
};

export function pickLocalized(language: AppLanguage, text: LocalizedTriple): string {
  if (language === 'en-US') return text.enUS;
  if (language === 'zh-TW') return text.zhTW;
  return text.zhCN;
}

/** 八字详细解读 · 免费档 paywall 文案 */
export function chartPaywallHint(language: AppLanguage): string {
  return pickLocalized(language, {
    zhCN: '当前为简版：可先看年度提点。升级会员可解锁每年「老师傅点评」与完整五年细化建议。',
    enUS: 'You are on the Lite tier: annual highlights are available. Upgrade to unlock full master notes and five-year details.',
    zhTW: '當前為簡版：可先看年度提點。升級會員可解鎖每年「老師傅點評」與完整五年細化建議。',
  });
}

export function chartUnlockFavorable(language: AppLanguage): string {
  return pickLocalized(language, {
    zhCN: '升级会员解锁该年详细「宜」策略',
    enUS: 'Upgrade to unlock this year’s detailed “Do” strategies',
    zhTW: '升級會員解鎖該年詳細「宜」策略',
  });
}

export function chartUnlockCaution(language: AppLanguage): string {
  return pickLocalized(language, {
    zhCN: '升级会员解锁该年详细「忌」提醒',
    enUS: 'Upgrade to unlock this year’s detailed “Avoid” reminders',
    zhTW: '升級會員解鎖該年詳細「忌」提醒',
  });
}

export function chartUnlockWindowMonths(language: AppLanguage): string {
  return pickLocalized(language, {
    zhCN: '升级会员解锁关键窗口月',
    enUS: 'Upgrade to unlock key timing windows',
    zhTW: '升級會員解鎖關鍵窗口月',
  });
}

export function chartFreeTeaserCommentary(language: AppLanguage, hint: string): string {
  if (language === 'en-US') {
    return `Master annual note: ${hint} (Lite tier)`;
  }
  if (language === 'zh-TW') {
    return `老師傅年度提點：${hint}（年度簡版）`;
  }
  return `老师傅年度提点：${hint}（年度简版）`;
}

/** 测字 · premiumHint */
export function ziPremiumHintNoFocus(language: AppLanguage): string {
  return pickLocalized(language, {
    zhCN: '升级会员可解锁完整方向推演（关键锚点/风险信号/行动计划）。',
    enUS: 'Upgrade to unlock full focus reading: key anchors, risk signals, and action plan.',
    zhTW: '升級會員可解鎖完整方向推演（關鍵錨點/風險信號/行動計畫）。',
  });
}

export function ziPremiumHintLiteFocus(language: AppLanguage): string {
  return pickLocalized(language, {
    zhCN: '当前为方向简版。升级会员可查看完整锚点、风险清单和3步行动计划。',
    enUS: 'You are on the Lite focus tier. Upgrade for full anchors, risk list, and a 3-step action plan.',
    zhTW: '當前為方向簡版。升級會員可查看完整錨點、風險清單和3步行動計畫。',
  });
}

export function ziPremiumHintDefault(language: AppLanguage): string {
  return pickLocalized(language, {
    zhCN: '升级会员可解锁完整方向锚点、风险信号和行动计划。',
    enUS: 'Upgrade to unlock full focus anchors, risk signals, and action plan.',
    zhTW: '升級會員可解鎖完整方向錨點、風險信號和行動計畫。',
  });
}

/** 测字 · 甲骨文 note */
export function ziOracleNotePaid(language: AppLanguage): string {
  return pickLocalized(language, {
    zhCN: '会员已解锁完整图像与异体视角，建议结合离合法交叉验证。',
    enUS: 'Member unlocked: full glyph variants available. Cross-check with split-combine reading.',
    zhTW: '會員已解鎖完整圖像與異體視角，建議結合離合法交叉驗證。',
  });
}

export function ziOracleNoteFree(language: AppLanguage): string {
  return pickLocalized(language, {
    zhCN: '当前为简版展示，升级会员可查看更多异体图像与差异解读。',
    enUS: 'Lite preview shown. Upgrade to view more glyph variants and difference notes.',
    zhTW: '當前為簡版展示，升級會員可查看更多異體圖像與差異解讀。',
  });
}
