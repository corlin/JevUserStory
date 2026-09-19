'use client';

import type { EvaluationOutcome, QuestionId } from '../src/domain/types';
import { QUESTION_SET_V1 } from '../src/gateway/question-set-v1';
import { ProbabilityBar } from './ui/probability-bar';
import { StatusBadge } from './ui/status-badge';

const LABELS: Record<QuestionId, string> = {
  department: 'Department',
  requested_resolution: 'Requested resolution',
  refund_requested: 'Refund requested',
  urgent: 'Urgent',
  policy_supports_action: 'Policy supports action',
  prompt_injection: 'Prompt injection',
  frustration: 'Frustration',
  severity: 'Severity',
  evidence_quality: 'Evidence quality',
};

function percentage(value: number): string {
  return `${Math.round(value * 100)}%`;
}

type DecisionTraceProps = {
  outcome?: EvaluationOutcome;
  errorCode?: string;
  onRetry?: () => void;
};

export function DecisionTrace({ outcome, errorCode, onRetry }: DecisionTraceProps) {
  const failureCode = errorCode ?? (outcome?.status === 'invalid' ? outcome.errorCode : undefined);
  return (
    <aside className="decision-panel" aria-labelledby="trace-title">
      <div className="decision-panel-header">
        <div><p className="section-kicker">Live evaluation</p><h2 id="trace-title">Decision trace</h2></div>
        <StatusBadge tone={outcome?.status === 'valid' ? 'success' : failureCode ? 'danger' : 'neutral'}>
          {outcome?.status === 'valid' ? 'Complete' : failureCode ? 'Needs review' : 'Ready'}
        </StatusBadge>
      </div>

      {failureCode ? (
        <div className="trace-error" role="alert">
          <strong>Evaluation could not be trusted</strong>
          <code>{failureCode}</code>
          <p>No automated action was taken.</p>
          {onRetry ? <button className="secondary-button" onClick={onRetry} type="button">重新运行评估</button> : null}
        </div>
      ) : outcome?.status === 'valid' ? (
        <ol className="trace-list">
          {(Object.entries(outcome.answers) as [QuestionId, typeof outcome.answers[QuestionId]][]).map(([id, answer], index) => (
            <li className="trace-item" key={id}>
              <span className="trace-index">{String(index + 1).padStart(2, '0')}</span>
              <div className="trace-content">
                <div className="trace-question">
                  <strong>{LABELS[id]}</strong>
                  <StatusBadge>{answer.type === 'boolean' ? 'Boolean' : answer.type === 'choice' ? 'Choice' : 'Score'}</StatusBadge>
                </div>
                {answer.type === 'boolean' ? (
                  <>
                    <p className="trace-primary">P(yes) {percentage(answer.probability)}</p>
                    <ProbabilityBar label="Yes probability" probability={answer.probability} />
                  </>
                ) : answer.type === 'choice' ? (
                  <>
                    <p className="trace-primary">Selected: {answer.choice}</p>
                    <ul className="distribution-list">
                      {Object.entries(answer.probabilities).map(([option, value]) => <li key={option}>{option} — {percentage(value)}</li>)}
                    </ul>
                    <div className="trace-metrics"><span>Top probability {percentage(answer.topProbability)}</span><span>Top-two margin {percentage(answer.topTwoMargin)}</span></div>
                  </>
                ) : (
                  <>
                    <p className="trace-primary">Score {answer.score.toFixed(2)}</p>
                    <ol className="rubric-list">
                      {QUESTION_SET_V1[id].type === 'score' ? QUESTION_SET_V1[id].criteria.map((level, levelIndex) => (
                        <li key={level}>Level {levelIndex} · {level}</li>
                      )) : null}
                    </ol>
                    <ul className="distribution-list">
                      {Object.entries(answer.probabilities).map(([level, value]) => <li key={level}>Level {level} — {percentage(value)}</li>)}
                    </ul>
                  </>
                )}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <div className="trace-empty">
          <span className="trace-orbit" aria-hidden="true" />
          <strong>Nine typed judgments</strong>
          <p>Run Jev to inspect Boolean probabilities, Choice distributions, and Score rubrics.</p>
        </div>
      )}
    </aside>
  );
}
