export type AppLanguage = 'zh-CN' | 'en-US' | 'zh-TW';

export function normalizeAppLanguage(raw?: string | null): AppLanguage {
  const input = String(raw || '').trim();
  if (!input) return 'zh-CN';
  if (input === 'zh-CN' || input === 'en-US' || input === 'zh-TW') return input;
  const lower = input.toLowerCase();
  if (lower.startsWith('en')) return 'en-US';
  if (lower.includes('tw') || lower.includes('hk') || lower === 'zh-hant') return 'zh-TW';
  return 'zh-CN';
}

export function buildOutputLanguageInstruction(language: AppLanguage): string {
  if (language === 'en-US') {
    return 'Output language must be English only. Do not include any Chinese characters. Self-check before final output.';
  }
  if (language === 'zh-TW') {
    return '輸出語言必須為繁體中文（zh-TW，臺灣用語）。禁止出現任何簡體字。請先自行校對，確認全文皆為繁體再輸出。';
  }
  return '输出语言必须为简体中文（zh-CN）。';
}

