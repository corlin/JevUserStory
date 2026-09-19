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
  policyVersion: 'resolveops-policy-v1';
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
