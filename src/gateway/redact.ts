const SECRET_KEYS = new Set([
  'authorization',
  'apikey',
  'ai_gateway_api_key',
  'x-ai-gateway-api-key',
]);

function isSecretKey(key: string): boolean {
  return SECRET_KEYS.has(key.toLowerCase());
}

export function redactForLog(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactForLog);
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message.replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]'),
    };
  }

  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        isSecretKey(key) ? '[REDACTED]' : redactForLog(nested),
      ]),
    );
  }

  return value;
}
