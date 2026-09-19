import { describe, expect, it } from 'vitest';

import { createGetCasesHandler } from '../../app/api/cases/route';
import { DEMO_CASES } from '../../src/fixtures/cases';

describe('GET /api/cases', () => {
  it('maps the zh query to Chinese fixtures only', async () => {
    const handler = createGetCasesHandler({
      listCases: (filters = {}) => DEMO_CASES.filter((fixture) => fixture.language === filters.language),
    });
    const response = await handler(new Request('http://localhost/api/cases?language=zh'));
    const body = await response.json() as { cases: typeof DEMO_CASES };

    expect(response.status).toBe(200);
    expect(body.cases.length).toBeGreaterThan(0);
    expect(body.cases.every((fixture) => fixture.language === 'zh-CN')).toBe(true);
  });
});
