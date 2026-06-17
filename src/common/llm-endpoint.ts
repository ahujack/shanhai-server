/**
 * 统一补全 OpenAI 兼容 chat/completions 路径。
 * 仅配置到 /v1 时 POST 会返回 405 Method Not Allowed。
 */
export function resolveChatCompletionsUrl(
  rawUrl?: string | null,
  fallback = 'https://api.deepseek.com/chat/completions',
): string {
  const trimmed = String(rawUrl ?? '').trim();
  if (!trimmed) return fallback;

  if (trimmed.includes('/audio/transcriptions')) {
    return trimmed;
  }

  if (trimmed.includes('/chat/completions')) {
    return trimmed.replace(/\/$/, '');
  }

  const base = trimmed.replace(/\/$/, '');
  return `${base}/chat/completions`;
}

export function resolveDeepSeekChatUrl(): string {
  return resolveChatCompletionsUrl(
    process.env.DEEPSEEK_API_URL || process.env.BAZI_LLM_API_URL,
  );
}

export function resolveMultimodalChatUrl(): string {
  return resolveChatCompletionsUrl(
    process.env.LLM_API_URL || process.env.LLM_URL,
    'https://api.apiyi.com/v1/chat/completions',
  );
}

export function resolveSttTranscriptionsUrl(): string {
  const raw =
    process.env.LLM_STT_API_URL ||
    process.env.STT_API_URL ||
    process.env.LLM_API_URL ||
    process.env.LLM_URL ||
    '';
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  if (trimmed.includes('/audio/transcriptions')) return trimmed.replace(/\/$/, '');
  if (trimmed.includes('/chat/completions')) {
    return trimmed.replace('/chat/completions', '/audio/transcriptions');
  }
  return `${trimmed.replace(/\/$/, '')}/audio/transcriptions`;
}
