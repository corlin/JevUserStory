import { randomUUID } from 'node:crypto';

import {
  experimental_evaluate as evaluate,
  InvalidResponseDataError,
  JSONParseError,
  TypeValidationError,
  type Experimental_EvaluationResult,
} from 'ai';

import type { CaseFixture, EvaluationRecord, QuestionId } from '../domain/types';
import { QUESTION_SET_V1, QUESTION_SET_VERSION } from './question-set-v1';
import { normalizeAnswers } from './normalize-answer';
import { redactForLog } from './redact';

const MODEL_ID = 'typesafe-ai/jev';
const QUESTION_IDS = Object.keys(QUESTION_SET_V1) as QuestionId[];

export type GatewayErrorCode =
  | 'GATEWAY_AUTHENTICATION_FAILED'
  | 'GATEWAY_MODEL_RESTRICTED'
  | 'GATEWAY_RATE_LIMITED'
  | 'GATEWAY_TIMEOUT'
  | 'GATEWAY_UNAVAILABLE';

export class GatewayEvaluationError extends Error {
  constructor(readonly code: GatewayErrorCode) {
    super(code);
    this.name = 'GatewayEvaluationError';
  }
}

type JevResult = Experimental_EvaluationResult<typeof QUESTION_SET_V1>;

type EvaluateCaseOptions = {
  caseId: CaseFixture['id'];
  logger?: Pick<Console, 'error'>;
  evaluate?: (input: {
    model: typeof MODEL_ID;
    state: string;
    questions: typeof QUESTION_SET_V1;
    maxRetries: 2;
  }) => Promise<JevResult>;
  now?: () => Date;
  createId?: () => string;
};

function statusCodeOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const candidate = error as { statusCode?: unknown; status?: unknown };
  const status = candidate.statusCode ?? candidate.status;
  return typeof status === 'number' ? status : undefined;
}

function mapGatewayError(error: unknown): GatewayErrorCode {
  const status = statusCodeOf(error);
  const name = error instanceof Error ? error.name.toLowerCase() : '';
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  if (message.includes('restricted') || message.includes('model access')) return 'GATEWAY_MODEL_RESTRICTED';
  if (status === 401 || status === 403 || message.includes('api key') || message.includes('authentication')) {
    return 'GATEWAY_AUTHENTICATION_FAILED';
  }
  if (status === 429 || message.includes('rate limit')) return 'GATEWAY_RATE_LIMITED';
  if ([408, 504].includes(status ?? 0) || name === 'aborterror' || message.includes('timeout')) {
    return 'GATEWAY_TIMEOUT';
  }
  return 'GATEWAY_UNAVAILABLE';
}

export async function evaluateCase(
  state: string,
  options: EvaluateCaseOptions,
): Promise<EvaluationRecord> {
  const startedAt = performance.now();
  const now = options.now ?? (() => new Date());
  const createId = options.createId ?? randomUUID;
  const callEvaluate = options.evaluate ?? evaluate;

  try {
    const result = await callEvaluate({
      model: MODEL_ID,
      state,
      questions: QUESTION_SET_V1,
      maxRetries: 2,
    });

    let outcome: EvaluationRecord['outcome'];
    try {
      outcome = {
        status: 'valid',
        answers: normalizeAnswers(result.answers, QUESTION_IDS),
      };
    } catch {
      outcome = { status: 'invalid', errorCode: 'INVALID_EVALUATION_RESPONSE' };
    }

    return {
      id: createId(),
      caseId: options.caseId,
      modelId: result.response.modelId || MODEL_ID,
      questionVersion: QUESTION_SET_VERSION,
      outcome,
      usage: {
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        totalTokens: result.usage.totalTokens,
      },
      latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
      createdAt: now().toISOString(),
    };
  } catch (error) {
    if (
      InvalidResponseDataError.isInstance(error)
      || JSONParseError.isInstance(error)
      || TypeValidationError.isInstance(error)
    ) {
      return {
        id: createId(),
        caseId: options.caseId,
        modelId: MODEL_ID,
        questionVersion: QUESTION_SET_VERSION,
        outcome: { status: 'invalid', errorCode: 'INVALID_EVALUATION_RESPONSE' },
        usage: {},
        latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
        createdAt: now().toISOString(),
      };
    }
    const code = mapGatewayError(error);
    options.logger?.error('Jev evaluation failed', redactForLog({
      code,
      error: error instanceof Error ? { name: error.name } : { type: typeof error },
    }));
    throw new GatewayEvaluationError(code);
  }
}
