import type { ResolveOpsDatabase } from './client';
import type {
  ExperimentCaseResultRecord,
  ExperimentRecord,
  ExperimentStatus,
} from '../domain/types';

type ExperimentRow = {
  id: string;
  model_id: string;
  question_version: string;
  policy_version: string;
  dataset_slice: string;
  status: ExperimentStatus;
  source_type: 'baseline' | 'live';
  total_cases: number;
  completed_cases: number;
  created_at: string;
  finished_at: string | null;
};

type ExperimentCaseResultRow = {
  id: string;
  experiment_id: string;
  case_id: string;
  answers_json: string;
  ground_truth_json: string;
  latency_ms: number;
  usage_json: string;
  policy_action: string;
  reason_codes_json: string;
  refund_cents: number;
  created_at: string;
};

function mapExperimentRow(row: ExperimentRow): ExperimentRecord {
  return {
    id: row.id,
    modelId: row.model_id,
    questionVersion: row.question_version,
    policyVersion: row.policy_version,
    datasetSlice: row.dataset_slice,
    status: row.status,
    sourceType: row.source_type,
    totalCases: row.total_cases,
    completedCases: row.completed_cases,
    createdAt: row.created_at,
    finishedAt: row.finished_at ?? undefined,
  };
}

function mapCaseResultRow(row: ExperimentCaseResultRow): ExperimentCaseResultRecord {
  return {
    id: row.id,
    experimentId: row.experiment_id,
    caseId: row.case_id as ExperimentCaseResultRecord['caseId'],
    answers: JSON.parse(row.answers_json),
    groundTruth: JSON.parse(row.ground_truth_json),
    latencyMs: row.latency_ms,
    usage: JSON.parse(row.usage_json),
    policyAction: row.policy_action as ExperimentCaseResultRecord['policyAction'],
    reasonCodes: JSON.parse(row.reason_codes_json),
    proposedRefundCents: row.refund_cents,
    createdAt: row.created_at,
  };
}

export function saveExperiment(database: ResolveOpsDatabase, record: ExperimentRecord): ExperimentRecord {
  const statement = database.prepare(`
    INSERT INTO experiments (
      id, model_id, question_version, policy_version, dataset_slice,
      status, source_type, total_cases, completed_cases, created_at, finished_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      completed_cases = excluded.completed_cases,
      finished_at = excluded.finished_at
  `);

  statement.run(
    record.id,
    record.modelId,
    record.questionVersion,
    record.policyVersion,
    record.datasetSlice,
    record.status,
    record.sourceType,
    record.totalCases,
    record.completedCases,
    record.createdAt,
    record.finishedAt ?? null,
  );

  return record;
}

export function updateExperimentStatus(
  database: ResolveOpsDatabase,
  id: string,
  update: { status: ExperimentStatus; completedCases?: number; finishedAt?: string },
): void {
  const current = findExperiment(database, id);
  if (!current) return;

  const completedCases = update.completedCases ?? current.completedCases;
  const finishedAt = update.finishedAt ?? current.finishedAt ?? null;

  database.prepare(`
    UPDATE experiments
    SET status = ?, completed_cases = ?, finished_at = ?
    WHERE id = ?
  `).run(update.status, completedCases, finishedAt, id);
}

export function findExperiment(database: ResolveOpsDatabase, id: string): ExperimentRecord | undefined {
  const row = database.prepare('SELECT * FROM experiments WHERE id = ?').get(id) as ExperimentRow | undefined;
  return row ? mapExperimentRow(row) : undefined;
}

export function listExperiments(database: ResolveOpsDatabase, limit = 20): ExperimentRecord[] {
  const rows = database.prepare(`
    SELECT * FROM experiments
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit) as ExperimentRow[];

  return rows.map(mapExperimentRow);
}

export function saveExperimentCaseResult(
  database: ResolveOpsDatabase,
  result: ExperimentCaseResultRecord,
): ExperimentCaseResultRecord {
  const statement = database.prepare(`
    INSERT INTO experiment_case_results (
      id, experiment_id, case_id, answers_json, ground_truth_json,
      latency_ms, usage_json, policy_action, reason_codes_json, refund_cents, created_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      answers_json = excluded.answers_json,
      ground_truth_json = excluded.ground_truth_json,
      latency_ms = excluded.latency_ms,
      usage_json = excluded.usage_json,
      policy_action = excluded.policy_action,
      reason_codes_json = excluded.reason_codes_json,
      refund_cents = excluded.refund_cents
  `);

  statement.run(
    result.id,
    result.experimentId,
    result.caseId,
    JSON.stringify(result.answers),
    JSON.stringify(result.groundTruth),
    result.latencyMs,
    JSON.stringify(result.usage),
    result.policyAction,
    JSON.stringify(result.reasonCodes),
    result.proposedRefundCents,
    result.createdAt,
  );

  return result;
}

export function listExperimentResults(
  database: ResolveOpsDatabase,
  experimentId: string,
): ExperimentCaseResultRecord[] {
  const rows = database.prepare(`
    SELECT * FROM experiment_case_results
    WHERE experiment_id = ?
    ORDER BY case_id ASC
  `).all(experimentId) as ExperimentCaseResultRow[];

  return rows.map(mapCaseResultRow);
}
