import { randomUUID } from 'node:crypto';

import { findCase } from '../../../../../src/db/case-repository';
import {
  findReviewDecision,
  saveReplyRun,
  type ReplyRunRecord,
  type ReviewDecisionRecord,
} from '../../../../../src/db/run-repository';
import type { CaseFixture } from '../../../../../src/domain/types';
import { generateApprovedReply, type GeneratedReply } from '../../../../../src/gateway/generate-reply';
import { verifyReply, type ReplyVerification } from '../../../../../src/gateway/verify-reply';
import { getDefaultDatabase } from '../../../../../src/services/case-service';

type ReplyDependencies = {
  findCase(caseId: string): CaseFixture | undefined;
  findReviewDecision(reviewId: string): ReviewDecisionRecord | undefined;
  generateApprovedReply(input: { caseFixture: CaseFixture; review: ReviewDecisionRecord | undefined }): Promise<GeneratedReply>;
  verifyReply(input: {
    draft: string;
    approvedAction: string;
    approvedRefundCents: number;
    refundPolicy: string;
  }): Promise<ReplyVerification>;
  saveReplyRun(record: ReplyRunRecord): ReplyRunRecord;
  createId(): string;
  now(): Date;
};

type RouteContext = { params: Promise<{ caseId: string }> };

export function createPostReplyHandler(dependencies: ReplyDependencies) {
  return async function POST(request: Request, context: RouteContext): Promise<Response> {
    const { caseId } = await context.params;
    if (!/^DEMO-\d{3}$/.test(caseId)) return Response.json({ error: { code: 'CASE_NOT_FOUND' } }, { status: 404 });
    const caseFixture = dependencies.findCase(caseId);
    if (!caseFixture) return Response.json({ error: { code: 'CASE_NOT_FOUND' } }, { status: 404 });

    try {
      const body = await request.json() as { reviewId?: unknown };
      const review = typeof body.reviewId === 'string' ? dependencies.findReviewDecision(body.reviewId) : undefined;
      if (!review || review.caseId !== caseId) {
        return Response.json({ error: { code: 'REVIEW_REQUIRED' } }, { status: 409 });
      }

      const generated = await dependencies.generateApprovedReply({ caseFixture, review });
      const verification = await dependencies.verifyReply({
        draft: generated.draft,
        approvedAction: review.action,
        approvedRefundCents: review.refundCents,
        refundPolicy: caseFixture.refundPolicy,
      });
      const record = dependencies.saveReplyRun({
        id: dependencies.createId(),
        caseId,
        reviewId: review.id,
        draft: generated.draft,
        verification,
        status: verification.status,
        createdAt: dependencies.now().toISOString(),
      });
      return Response.json(record);
    } catch {
      return Response.json({ error: { code: 'REPLY_GENERATION_FAILED' } }, { status: 502 });
    }
  };
}

function defaultDependencies(): ReplyDependencies {
  const database = getDefaultDatabase();
  return {
    findCase: (caseId) => findCase(database, caseId),
    findReviewDecision: (reviewId) => findReviewDecision(database, reviewId),
    generateApprovedReply,
    verifyReply,
    saveReplyRun: (record) => saveReplyRun(database, record),
    createId: randomUUID,
    now: () => new Date(),
  };
}

export const POST = async (request: Request, context: RouteContext) => createPostReplyHandler(defaultDependencies())(request, context);
