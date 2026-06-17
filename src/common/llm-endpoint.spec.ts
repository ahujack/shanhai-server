import {
  resolveChatCompletionsUrl,
  resolveSttTranscriptionsUrl,
} from './llm-endpoint';

describe('llm-endpoint', () => {
  it('appends /chat/completions when only /v1 is configured', () => {
    expect(resolveChatCompletionsUrl('https://llm-proxy.example.com/v1')).toBe(
      'https://llm-proxy.example.com/v1/chat/completions',
    );
  });

  it('keeps full chat/completions url unchanged', () => {
    expect(
      resolveChatCompletionsUrl('https://llm-proxy.example.com/v1/chat/completions'),
    ).toBe('https://llm-proxy.example.com/v1/chat/completions');
  });

  it('derives transcriptions url from chat/completions base', () => {
    const prev = process.env.LLM_API_URL;
    process.env.LLM_API_URL = 'http://proxy/v1/chat/completions';
    expect(resolveSttTranscriptionsUrl()).toBe(
      'http://proxy/v1/audio/transcriptions',
    );
    process.env.LLM_API_URL = prev;
  });
});
