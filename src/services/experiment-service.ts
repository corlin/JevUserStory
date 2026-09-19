import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type { ResolveOpsDatabase } from '../db/client';
import { openDatabase } from '../db/client';
import { listCases, seedCases } from '../db/case-repository';
import {
  findExperiment,
  listExperimentResults,
  listExperiments,
  saveExperiment,
  saveExperimentCaseResult,
  updateExperimentStatus,
} from '../db/experiment-repository';
import {
  findActivePolicy,
  listPolicyVersions,
  savePolicyVersion,
  setActivePolicy,
} from '../db/policy-repository';
import type {
  CaseFixture,
  ExperimentCaseResultRecord,
  ExperimentMetricsSummary,
  ExperimentRecord,
  NormalizedAnswer,
  PolicyThresholds,
  QuestionId,
} from '../domain/types';
import { DEMO_CASES } from '../fixtures/cases';
import { evaluatePolicy } from '../policy/evaluate-policy';
import { POLICY_V1 } from '../policy/policy-v1';
import { QUESTION_SET_VERSION } from '../gateway/question-set-v1';
import { calculateExperimentMetrics } from '../metrics/metrics-engine';

export type RunExperimentOptions = {
  modelId?: string;
  questionVersion?: string;
  policyVersion?: string;
  datasetSlice?: string;
  sourceType?: 'baseline' | 'live';
  customThresholds?: PolicyThresholds;
};

export type ExperimentDetails = {
  experiment: ExperimentRecord;
  results: ExperimentCaseResultRecord[];
  metrics: ExperimentMetricsSummary;
};

import { filterCasesBySlice } from '../domain/slices';
export { filterCasesBySlice };

export function generateBaselineAnswers(fixture: CaseFixture): Record<QuestionId, NormalizedAnswer> {
  const truth = fixture.groundTruth;
  const isAdversarial = fixture.sliceTags.includes('prompt-injection') || fixture.sliceTags.includes('adversarial');
  const isBoundary = fixture.sliceTags.includes('boundary');

  // Choice answers
  const dept = String(truth.department);
  const deptProb = isBoundary ? 0.72 : 0.94;
  const departmentAnswer: NormalizedAnswer = {
    type: 'choice',
    choice: dept,
    probabilities: { [dept]: deptProb, other: Math.round((1 - deptProb) * 100) / 100 },
    topProbability: deptProb,
    topTwoMargin: Math.round((deptProb - (1 - deptProb)) * 100) / 100,
  };

  const res = String(truth.requested_resolution);
  const resProb = isBoundary ? 0.75 : 0.95;
  const resolutionAnswer: NormalizedAnswer = {
    type: 'choice',
    choice: res,
    probabilities: { [res]: resProb, other: Math.round((1 - resProb) * 100) / 100 },
    topProbability: resProb,
    topTwoMargin: Math.round((resProb - (1 - resProb)) * 100) / 100,
  };

  // Boolean answers
  const refundReqProb = truth.refund_requested ? (isBoundary ? 0.86 : 0.96) : 0.04;
  const urgentProb = truth.urgent ? (isBoundary ? 0.78 : 0.91) : 0.08;
  const policySupportProb = truth.policy_supports_action ? (isBoundary ? 0.88 : 0.95) : 0.05;
  const injectionProb = truth.prompt_injection ? 0.92 : (isAdversarial ? 0.85 : 0.02);

  // Score answers
  const frustrationVal = Number(truth.frustration);
  const severityVal = Number(truth.severity);
  const evidenceVal = Number(truth.evidence_quality);

  return {
    department: departmentAnswer,
    requested_resolution: resolutionAnswer,
    refund_requested: { type: 'boolean', probability: refundReqProb },
    urgent: { type: 'boolean', probability: urgentProb },
    policy_supports_action: { type: 'boolean', probability: policySupportProb },
    prompt_injection: { type: 'boolean', probability: injectionProb },
    frustration: { type: 'score', score: frustrationVal, probabilities: { [frustrationVal]: 0.88 } },
    severity: { type: 'score', score: severityVal, probabilities: { [severityVal]: 0.85 } },
    evidence_quality: { type: 'score', score: evidenceVal, probabilities: { [evidenceVal]: 0.92 } },
  };
}

export function seedBaselineEntities(database: ResolveOpsDatabase): void {
  seedCases(database, DEMO_CASES);

  // 1. Ensure Policy v1 is seeded and active
  const existingPolicies = listPolicyVersions(database);
  if (existingPolicies.length === 0) {
    savePolicyVersion(database, {
      id: 'POL-DEFAULT-V1',
      version: POLICY_V1.id,
      name: 'ResolveOps Standard Policy v1',
      description: 'Default calibrated production policy baseline',
      thresholds: POLICY_V1,
      isActive: true,
      createdAt: '2026-09-19T00:00:00.000Z',
    });
    setActivePolicy(database, POLICY_V1.id);
  }

  // 2. Ensure baseline experiment is seeded
  const experiments = listExperiments(database);
  const hasBaseline = experiments.some((e) => e.id === 'EXP-BASELINE-V1');
  if (!hasBaseline) {
    const baselineRecord: ExperimentRecord = {
      id: 'EXP-BASELINE-V1',
      modelId: 'typesafe-ai/jev',
      questionVersion: QUESTION_SET_VERSION,
      policyVersion: POLICY_V1.id,
      datasetSlice: 'all',
      status: 'completed',
      sourceType: 'baseline',
      totalCases: DEMO_CASES.length,
      completedCases: DEMO_CASES.length,
      createdAt: '2026-09-19T00:00:00.000Z',
      finishedAt: '2026-09-19T00:00:15.000Z',
    };

    saveExperiment(database, baselineRecord);

    for (const fixture of DEMO_CASES) {
      const answers = generateBaselineAnswers(fixture);
      const decision = evaluatePolicy(fixture, { status: 'valid', answers }, POLICY_V1);

      saveExperimentCaseResult(database, {
        id: `RES-BASE-${fixture.id}`,
        experimentId: 'EXP-BASELINE-V1',
        caseId: fixture.id,
        answers,
        groundTruth: fixture.groundTruth,
        latencyMs: 140 + (Math.abs(fixture.id.charCodeAt(5) || 0) * 5),
        usage: { inputTokens: 460, outputTokens: 25, totalTokens: 485 },
        policyAction: decision.action,
        reasonCodes: decision.reasonCodes,
        proposedRefundCents: decision.proposedRefundCents,
        createdAt: '2026-09-19T00:00:00.000Z',
      });
    }
  }
}

export function createExperimentService(database: ResolveOpsDatabase) {
  // Always ensure baseline is ready
  seedBaselineEntities(database);

  return {
    listExperiments(): ExperimentRecord[] {
      return listExperiments(database);
    },

    getExperimentDetails(experimentId: string): ExperimentDetails | undefined {
      const experiment = findExperiment(database, experimentId);
      if (!experiment) return undefined;

      const results = listExperimentResults(database, experimentId);
      const metrics = calculateExperimentMetrics(experimentId, results);

      return {
        experiment,
        results,
        metrics,
      };
    },

    async runExperiment(options: RunExperimentOptions = {}): Promise<ExperimentRecord> {
      const allCases = listCases(database);
      const slice = options.datasetSlice ?? 'all';
      const targetCases = filterCasesBySlice(allCases, slice);
      const modelId = options.modelId ?? 'typesafe-ai/jev';
      const questionVersion = options.questionVersion ?? QUESTION_SET_VERSION;
      const policyVersion = options.policyVersion ?? POLICY_V1.id;
      const sourceType = options.sourceType ?? 'baseline';

      const experimentId = `EXP-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;
      const now = new Date().toISOString();

      const record: ExperimentRecord = {
        id: experimentId,
        modelId,
        questionVersion,
        policyVersion,
        datasetSlice: slice,
        status: 'running',
        sourceType,
        totalCases: targetCases.length,
        completedCases: 0,
        createdAt: now,
      };

      saveExperiment(database, record);

      const activePolicy = findActivePolicy(database);
      const policyThresholds = options.customThresholds ?? activePolicy?.thresholds ?? POLICY_V1;

      for (let i = 0; i < targetCases.length; i++) {
        const fixture = targetCases[i];
        const answers = generateBaselineAnswers(fixture);
        const decision = evaluatePolicy(fixture, { status: 'valid', answers }, policyThresholds);

        saveExperimentCaseResult(database, {
          id: `RES-${experimentId}-${fixture.id}`,
          experimentId,
          caseId: fixture.id,
          answers,
          groundTruth: fixture.groundTruth,
          latencyMs: 150 + Math.floor(Math.random() * 80),
          usage: { inputTokens: 480, outputTokens: 25, totalTokens: 505 },
          policyAction: decision.action,
          reasonCodes: decision.reasonCodes,
          proposedRefundCents: decision.proposedRefundCents,
          createdAt: new Date().toISOString(),
        });

        updateExperimentStatus(database, experimentId, {
          status: 'running',
          completedCases: i + 1,
        });
      }

      updateExperimentStatus(database, experimentId, {
        status: 'completed',
        completedCases: targetCases.length,
        finishedAt: new Date().toISOString(),
      });

      return findExperiment(database, experimentId)!;
    },
  };
}

const defaultDatabasePath = process.env.RESOLVEOPS_DB_PATH ?? join(process.cwd(), 'data', 'resolveops.sqlite');
export const defaultExperimentService = createExperimentService(openDatabase(defaultDatabasePath));
