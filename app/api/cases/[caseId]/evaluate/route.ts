import { GatewayEvaluationError } from '../../../../../src/gateway/evaluate-case';
import {
  defaultCaseService,
  type CaseEvaluationResult,
} from '../../../../../src/services/case-service';

type EvaluationService = {
  evaluateAndPersistCase(caseId: string): Promise<CaseEvaluationResult>;
};

type RouteContext = {
  params: Promise<{ caseId: string }>;
};

export function createPostEvaluationHandler(service: EvaluationService) {
  return async function POST(_request: Request, context: RouteContext): Promise<Response> {
    const { caseId } = await context.params;
    if (!/^DEMO-\d{3}$/.test(caseId)) {
      return Response.json({ error: { code: 'CASE_NOT_FOUND' } }, { status: 404 });
    }

    try {
      const result = await service.evaluateAndPersistCase(caseId);
      return Response.json(result);
    } catch (error) {
      if (error instanceof GatewayEvaluationError) {
        return Response.json({ error: { code: error.code } }, { status: 502 });
      }
      if (error instanceof Error && error.message === 'CASE_NOT_FOUND') {
        return Response.json({ error: { code: 'CASE_NOT_FOUND' } }, { status: 404 });
      }
      return Response.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
    }
  };
}

export const POST = createPostEvaluationHandler(defaultCaseService);
