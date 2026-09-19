import type { CaseFixture } from '../../../src/domain/types';
import { defaultCaseService, type CaseService } from '../../../src/services/case-service';

type CaseListService = Pick<CaseService, 'listCases'>;

function languageFromQuery(value: string | null): CaseFixture['language'] | undefined {
  if (value === 'zh' || value === 'zh-CN') return 'zh-CN';
  if (value === 'en') return 'en';
  return undefined;
}

export function createGetCasesHandler(service: CaseListService) {
  return async function GET(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const requestedLanguage = url.searchParams.get('language');
    if (requestedLanguage && !['zh', 'zh-CN', 'en'].includes(requestedLanguage)) {
      return Response.json({ error: { code: 'INVALID_LANGUAGE' } }, { status: 400 });
    }

    const cases = service.listCases({
      language: languageFromQuery(requestedLanguage),
      tag: url.searchParams.get('tag') ?? undefined,
    });
    return Response.json({ cases });
  };
}

export const GET = createGetCasesHandler(defaultCaseService);
