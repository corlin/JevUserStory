export type QuestionId =
  | 'department'
  | 'requested_resolution'
  | 'refund_requested'
  | 'urgent'
  | 'policy_supports_action'
  | 'prompt_injection'
  | 'frustration'
  | 'severity'
  | 'evidence_quality';

export type BooleanQuestionDefinition = {
  type: 'boolean';
  instructions: string;
  criteria?: { true: string; false: string };
};

export type ChoiceQuestionDefinition = {
  type: 'choice';
  instructions: string;
  criteria: Record<string, string>;
};

export type ScoreQuestionDefinition = {
  type: 'score';
  instructions: string;
  criteria: string[];
};

export type QuestionDefinition =
  | BooleanQuestionDefinition
  | ChoiceQuestionDefinition
  | ScoreQuestionDefinition;

export type NormalizedAnswer =
  | { type: 'boolean'; probability: number }
  | {
      type: 'choice';
      choice: string;
      probabilities: Record<string, number>;
      topProbability: number;
      topTwoMargin: number;
    }
  | { type: 'score'; score: number; probabilities: Record<string, number> };

export type EvaluationOutcome =
  | { status: 'valid'; answers: Record<QuestionId, NormalizedAnswer> }
  | {
      status: 'invalid';
      errorCode: 'INVALID_EVALUATION_RESPONSE' | 'GATEWAY_UNAVAILABLE';
    };

export type PolicyAction = 'auto' | 'confirm' | 'review' | 'block';

export interface PolicyDecision {
  action: PolicyAction;
  reasonCodes: string[];
  proposedRefundCents: number;
  policyVersion: string;
}

export type GroundTruthAnswer = boolean | string | number;

export interface CaseFixture {
  id: `DEMO-${string}`;
  title: string;
  language: 'en' | 'zh-CN';
  sliceTags: string[];
  customer: {
    id: string;
    name: string;
    tier: 'Standard' | 'Silver' | 'Gold';
    message: string;
  };
  order: {
    id: `DEMO-${string}`;
    currency: 'USD';
    totalCents: number;
    itemSummary: string;
  };
  payments: Array<{
    id: `DEMO-${string}`;
    amountCents: number;
    status: 'captured' | 'pending' | 'refunded' | 'failed';
  }>;
  shipment: {
    status: 'not_shipped' | 'in_transit' | 'delivered' | 'lost';
    delayDays: number;
    estimatedDeliveryDate: string;
  };
  refundPolicy: string;
  groundTruth: Record<QuestionId, GroundTruthAnswer>;
  sourceCaseId?: `DEMO-${string}`;
  mutationDescription?: string;
}

export interface EvaluationUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface EvaluationRecord {
  id: string;
  caseId: CaseFixture['id'];
  modelId: string;
  questionVersion: 'resolveops-questions-v1';
  outcome: EvaluationOutcome;
  usage: EvaluationUsage;
  latencyMs: number;
  createdAt: string;
}

export interface PolicyThresholds {
  id?: string;
  refundAutoMinimum: number;
  policySupportMinimum: number;
  injectionReviewMinimum: number;
  booleanUncertainLower: number;
  booleanUncertainUpper: number;
  highRiskRefundCents: number;
  replyReviewMinimum: number;
  choiceTopMinimum: number;
  choiceMarginMinimum: number;
  scoreTopMinimum: number;
  evidenceScoreMinimum: number;
}

export interface PolicyVersionRecord {
  id: string;
  version: string;
  name: string;
  description?: string;
  thresholds: PolicyThresholds;
  isActive: boolean;
  createdAt: string;
}

export interface QuestionSetVersionRecord {
  id: string;
  version: string;
  name: string;
  description?: string;
  questions: Record<QuestionId, QuestionDefinition>;
  createdAt: string;
}

export type ExperimentSourceType = 'baseline' | 'live';
export type ExperimentStatus = 'running' | 'completed' | 'failed';

export interface ExperimentRecord {
  id: string;
  modelId: string;
  questionVersion: string;
  policyVersion: string;
  datasetSlice: string;
  status: ExperimentStatus;
  sourceType: ExperimentSourceType;
  totalCases: number;
  completedCases: number;
  createdAt: string;
  finishedAt?: string;
}

export interface ExperimentCaseResultRecord {
  id: string;
  experimentId: string;
  caseId: CaseFixture['id'];
  answers: Record<QuestionId, NormalizedAnswer>;
  groundTruth: Record<QuestionId, GroundTruthAnswer>;
  latencyMs: number;
  usage: EvaluationUsage;
  policyAction: PolicyAction;
  reasonCodes: string[];
  proposedRefundCents: number;
  createdAt: string;
}

export interface CalibrationBin {
  binIndex: number;
  binLower: number;
  binUpper: number;
  averageConfidence: number;
  empiricalAccuracy: number;
  count: number;
}

export interface ChoiceMetric {
  questionId: QuestionId;
  accuracy: number;
  macroF1: number;
  total: number;
  correct: number;
}

export interface BooleanMetric {
  questionId: QuestionId;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  ece: number;
  bins: CalibrationBin[];
}

export interface ScoreMetric {
  questionId: QuestionId;
  mae: number;
  withinOneAccuracy: number;
  total: number;
}

export interface BusinessPolicyMetrics {
  totalCases: number;
  autoCount: number;
  autoRate: number;
  confirmCount: number;
  confirmRate: number;
  reviewCount: number;
  reviewRate: number;
  blockCount: number;
  blockRate: number;
  falseAutomationCount: number;
  falseAutomationRate: number;
}

export interface SystemPerformanceMetrics {
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  averageLatencyMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
}

export interface ExperimentMetricsSummary {
  experimentId: string;
  totalCases: number;
  business: BusinessPolicyMetrics;
  performance: SystemPerformanceMetrics;
  choiceMetrics: Record<string, ChoiceMetric>;
  booleanMetrics: Record<string, BooleanMetric>;
  scoreMetrics: Record<string, ScoreMetric>;
  sliceMetrics?: Record<string, {
    totalCases: number;
    accuracy: number;
    autoRate: number;
    reviewRate: number;
    blockRate: number;
  }>;
}

