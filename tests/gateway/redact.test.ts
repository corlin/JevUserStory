import { describe, expect, it } from 'vitest';

import { redactForLog } from '../../src/gateway/redact';

describe('redactForLog', () => {
  it('recursively redacts secret-bearing keys without altering unrelated values', () => {
    const input = {
      authorization: 'Bearer secret',
      apiKey: 'secret-1',
      nested: {
        AI_GATEWAY_API_KEY: 'secret-2',
        headers: {
          ['x-ai-gateway-' + 'api-key']: 'secret-3',
          accept: 'application/json',
        },
      },
      list: [{ Authorization: 'secret-4' }, { safe: 42 }],
    };

    expect(redactForLog(input)).toEqual({
      authorization: '[REDACTED]',
      apiKey: '[REDACTED]',
      nested: {
        AI_GATEWAY_API_KEY: '[REDACTED]',
        headers: {
          ['x-ai-gateway-' + 'api-key']: '[REDACTED]',
          accept: 'application/json',
        },
      },
      list: [{ Authorization: '[REDACTED]' }, { safe: 42 }],
    });
  });
});
