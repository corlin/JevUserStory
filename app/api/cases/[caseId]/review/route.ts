import {
  defaultReviewService,
  type ReviewInput,
  type ReviewService,
} from '../../../../../src/services/review-service';

type RouteContext = { params: Promise<{ caseId: string }> };

const CLIENT_ERRORS = new Set([
  'INVALID_REVIEW_ACTION',
  'INVALID_REFUND_AMOUNT',
  'REFUND_EXCEEDS_VERIFIED_AMOUNT',
  'INVALID_IDEMPOTENCY_KEY',
]);

export function createPostReviewHandler(service: ReviewService) {
  return async function POST(request: Request, context: RouteContext): Promise<Response> {
    const { caseId } = await context.params;
    if (!/^DEMO-\d{3}$/.test(caseId)) {
      return Response.json({ error: { code: 'CASE_NOT_FOUND' } }, { status: 404 });
    }

    try {
      const body = await request.json() as Omit<ReviewInput, 'caseId'>;
      const decision = await service.recordReview({ ...body, caseId });
      return Response.json(decision, { status: 201 });
    } catch (error) {
      const code = error instanceof Error ? error.message : 'INVALID_REVIEW_REQUEST';
      if (code === 'CASE_NOT_FOUND') {
        return Response.json({ error: { code } }, { status: 404 });
      }
      if (CLIENT_ERRORS.has(code)) {
        return Response.json({ error: { code } }, { status: 400 });
      }
      return Response.json({ error: { code: 'INVALID_REVIEW_REQUEST' } }, { status: 400 });
    }
  };
}

export const POST = createPostReviewHandler(defaultReviewService);
