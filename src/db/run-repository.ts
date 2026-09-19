import type { EvaluationRecord, PolicyDecision } from '../domain/types';
import type { ResolveOpsDatabase } from './client';

type EvaluationRow = {
  id: string;
  case_id: EvaluationRecord['caseId'];
  model_id: string;
  question_version: EvaluationRecord['questionVersion'];
  answers_json: string;
  usage_json: string;
  latency_ms: number;
  created_at: string;
};

export type PolicyDecisionRecord = PolicyDecision & {
  id: string;
  runId: string;
  createdAt: string;
};

export type ReviewAction = 'confirm_refund' | 'modify_refund' | 'escalate' | 'reject';

export type ReviewDecisionRecord = {
  id: string;
  caseId: string;
  idempotencyKey: string;
  action: ReviewAction;
  refundCents: number;
  note: string;
  createdAt: string;
};

type ReviewRow = {
  id: string;
  case_id: string;
  idempotency_key: string;
  action: ReviewAction;
  refund_cents: number;
  note: string;
  created_at: string;
};

function parseEvaluation(row: EvaluationRow): EvaluationRecord {
  return {
    id: row.id,
    caseId: row.case_id,
    modelId: row.model_id,
    questionVersion: row.question_version,
    outcome: JSON.parse(row.answers_json) as EvaluationRecord['outcome'],
    usage: JSON.parse(row.usage_json) as EvaluationRecord['usage'],
    latencyMs: row.latency_ms,
    createdAt: row.created_at,
  };
}

function parseReview(row: ReviewRow): ReviewDecisionRecord {
  return {
    id: row.id,
    caseId: row.case_id,
    idempotencyKey: row.idempotency_key,
    action: row.action,
    refundCents: row.refund_cents,
    note: row.note,
    createdAt: row.created_at,
  };
}

export function saveEvaluationRun(database: ResolveOpsDatabase, record: EvaluationRecord): EvaluationRecord {
  database.prepare(`
    INSERT INTO evaluation_runs (
      id, case_id, model_id, question_version, answers_json, usage_json, latency_ms, created_at
    ) VALUES (
      @id, @caseId, @modelId, @questionVersion, @answersJson, @usageJson, @latencyMs, @createdAt
    )
  `).run({
    ...record,
    answersJson: JSON.stringify(record.outcome),
    usageJson: JSON.stringify(record.usage),
  });
  return record;
}

export function findEvaluationRun(database: ResolveOpsDatabase, runId: string): EvaluationRecord | undefined {
  const row = database.prepare('SELECT * FROM evaluation_runs WHERE id = ?').get(runId) as EvaluationRow | undefined;
  return row ? parseEvaluation(row) : undefined;
}

export function savePolicyDecision(database: ResolveOpsDatabase, decision: PolicyDecisionRecord): PolicyDecisionRecord {
  database.prepare(`
    INSERT INTO policy_decisions (
      id, run_id, policy_version, action, reason_codes_json, refund_cents, created_at
    ) VALUES (
      @id, @runId, @policyVersion, @action, @reasonCodesJson, @proposedRefundCents, @createdAt
    )
  `).run({
    ...decision,
    reasonCodesJson: JSON.stringify(decision.reasonCodes),
  });
  return decision;
}

export function saveReviewDecision(
  database: ResolveOpsDatabase,
  decision: ReviewDecisionRecord,
): ReviewDecisionRecord {
  return database.transaction((input: ReviewDecisionRecord) => {
    const existing = database
      .prepare('SELECT * FROM review_decisions WHERE idempotency_key = ?')
      .get(input.idempotencyKey) as ReviewRow | undefined;
    if (existing) return parseReview(existing);

    database.prepare(`
      INSERT INTO review_decisions (
        id, case_id, idempotency_key, action, refund_cents, note, created_at
      ) VALUES (
        @id, @caseId, @idempotencyKey, @action, @refundCents, @note, @createdAt
      )
    `).run(input);
    return input;
  })(decision);
}

export function countReviewDecisions(database: ResolveOpsDatabase): number {
  const row = database.prepare('SELECT COUNT(*) AS count FROM review_decisions').get() as { count: number };
  return row.count;
}
