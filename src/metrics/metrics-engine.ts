import type {
  BooleanMetric,
  BusinessPolicyMetrics,
  CalibrationBin,
  ChoiceMetric,
  ExperimentCaseResultRecord,
  ExperimentMetricsSummary,
  QuestionId,
  ScoreMetric,
  SystemPerformanceMetrics,
} from '../domain/types';

const CHOICE_QUESTIONS: QuestionId[] = ['department', 'requested_resolution'];
const BOOLEAN_QUESTIONS: QuestionId[] = [
  'refund_requested',
  'urgent',
  'policy_supports_action',
  'prompt_injection',
];
const SCORE_QUESTIONS: QuestionId[] = ['frustration', 'severity', 'evidence_quality'];

export function calculateChoiceMetric(
  questionId: QuestionId,
  results: ExperimentCaseResultRecord[],
): ChoiceMetric {
  if (results.length === 0) {
    return { questionId, accuracy: 0, macroF1: 0, total: 0, correct: 0 };
  }

  let correct = 0;
  const classes = new Set<string>();

  for (const r of results) {
    const ans = r.answers[questionId];
    const truth = String(r.groundTruth[questionId]);
    classes.add(truth);
    if (ans.type === 'choice') {
      classes.add(ans.choice);
      if (ans.choice === truth) correct++;
    }
  }

  const accuracy = correct / results.length;

  // Macro-F1 across all unique classes observed in ground truth or predictions
  let f1Sum = 0;
  const classList = Array.from(classes);
  for (const cls of classList) {
    let tp = 0;
    let fp = 0;
    let fn = 0;

    for (const r of results) {
      const ans = r.answers[questionId];
      const truth = String(r.groundTruth[questionId]);
      const pred = ans.type === 'choice' ? ans.choice : '';

      if (pred === cls && truth === cls) tp++;
      else if (pred === cls && truth !== cls) fp++;
      else if (pred !== cls && truth === cls) fn++;
    }

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    f1Sum += f1;
  }

  const macroF1 = classList.length > 0 ? f1Sum / classList.length : 0;

  return {
    questionId,
    accuracy,
    macroF1,
    total: results.length,
    correct,
  };
}

export function calculateBooleanMetric(
  questionId: QuestionId,
  results: ExperimentCaseResultRecord[],
): BooleanMetric {
  if (results.length === 0) {
    return {
      questionId,
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1: 0,
      ece: 0,
      bins: [],
    };
  }

  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;

  // 10 calibration bins: [0, 0.1), [0.1, 0.2), ..., [0.9, 1.0]
  const numBins = 10;
  const binCounts = new Array(numBins).fill(0);
  const binProbSums = new Array(numBins).fill(0);
  const binTruthSums = new Array(numBins).fill(0);

  for (const r of results) {
    const ans = r.answers[questionId];
    const truth = Boolean(r.groundTruth[questionId]);
    const prob = ans.type === 'boolean' ? ans.probability : 0;
    const pred = prob >= 0.5;

    if (pred && truth) tp++;
    else if (pred && !truth) fp++;
    else if (!pred && !truth) tn++;
    else fn++;

    // Assign to bin
    let binIdx = Math.floor(prob * numBins);
    if (binIdx >= numBins) binIdx = numBins - 1;
    if (binIdx < 0) binIdx = 0;

    binCounts[binIdx]++;
    binProbSums[binIdx] += prob;
    binTruthSums[binIdx] += truth ? 1 : 0;
  }

  const total = results.length;
  const accuracy = (tp + tn) / total;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  let totalEce = 0;
  const bins: CalibrationBin[] = [];

  for (let i = 0; i < numBins; i++) {
    const count = binCounts[i];
    const binLower = i / numBins;
    const binUpper = (i + 1) / numBins;
    const avgConf = count > 0 ? binProbSums[i] / count : (binLower + binUpper) / 2;
    const empiricalAcc = count > 0 ? binTruthSums[i] / count : 0;

    if (count > 0) {
      totalEce += (count / total) * Math.abs(avgConf - empiricalAcc);
    }

    bins.push({
      binIndex: i,
      binLower,
      binUpper,
      averageConfidence: avgConf,
      empiricalAccuracy: empiricalAcc,
      count,
    });
  }

  return {
    questionId,
    accuracy,
    precision,
    recall,
    f1,
    ece: totalEce,
    bins,
  };
}

export function calculateScoreMetric(
  questionId: QuestionId,
  results: ExperimentCaseResultRecord[],
): ScoreMetric {
  if (results.length === 0) {
    return { questionId, mae: 0, withinOneAccuracy: 0, total: 0 };
  }

  let totalDiff = 0;
  let withinOneCount = 0;

  for (const r of results) {
    const ans = r.answers[questionId];
    const truth = Number(r.groundTruth[questionId]);
    const pred = ans.type === 'score' ? ans.score : 0;
    const diff = Math.abs(pred - truth);

    totalDiff += diff;
    if (diff <= 1) withinOneCount++;
  }

  return {
    questionId,
    mae: totalDiff / results.length,
    withinOneAccuracy: withinOneCount / results.length,
    total: results.length,
  };
}

export function calculateBusinessMetrics(results: ExperimentCaseResultRecord[]): BusinessPolicyMetrics {
  const totalCases = results.length;
  if (totalCases === 0) {
    return {
      totalCases: 0,
      autoCount: 0,
      autoRate: 0,
      confirmCount: 0,
      confirmRate: 0,
      reviewCount: 0,
      reviewRate: 0,
      blockCount: 0,
      blockRate: 0,
      falseAutomationCount: 0,
      falseAutomationRate: 0,
    };
  }

  let autoCount = 0;
  let confirmCount = 0;
  let reviewCount = 0;
  let blockCount = 0;
  let falseAutomationCount = 0;

  for (const r of results) {
    switch (r.policyAction) {
      case 'auto':
        autoCount++;
        // Check for false automation: action is auto, but Ground Truth says policy_supports_action is false or refund_requested is false
        if (r.groundTruth.policy_supports_action === false || r.groundTruth.refund_requested === false) {
          falseAutomationCount++;
        }
        break;
      case 'confirm':
        confirmCount++;
        break;
      case 'review':
        reviewCount++;
        break;
      case 'block':
        blockCount++;
        break;
    }
  }

  return {
    totalCases,
    autoCount,
    autoRate: autoCount / totalCases,
    confirmCount,
    confirmRate: confirmCount / totalCases,
    reviewCount,
    reviewRate: reviewCount / totalCases,
    blockCount,
    blockRate: blockCount / totalCases,
    falseAutomationCount,
    falseAutomationRate: falseAutomationCount / totalCases,
  };
}

export function calculatePerformanceMetrics(results: ExperimentCaseResultRecord[]): SystemPerformanceMetrics {
  const totalCases = results.length;
  if (totalCases === 0) {
    return {
      p50LatencyMs: 0,
      p95LatencyMs: 0,
      p99LatencyMs: 0,
      averageLatencyMs: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
    };
  }

  const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b);
  const totalLatency = latencies.reduce((acc, v) => acc + v, 0);

  const p50Idx = Math.floor(latencies.length * 0.5);
  const p95Idx = Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95));
  const p99Idx = Math.min(latencies.length - 1, Math.floor(latencies.length * 0.99));

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalTokens = 0;

  for (const r of results) {
    totalInputTokens += r.usage.inputTokens ?? 0;
    totalOutputTokens += r.usage.outputTokens ?? 0;
    totalTokens += r.usage.totalTokens ?? (r.usage.inputTokens ?? 0) + (r.usage.outputTokens ?? 0);
  }

  // Cost estimate: $0.15/1M input, $0.60/1M output tokens (standard gateway tier)
  const estimatedCostUsd = (totalInputTokens / 1_000_000) * 0.15 + (totalOutputTokens / 1_000_000) * 0.6;

  return {
    p50LatencyMs: latencies[p50Idx],
    p95LatencyMs: latencies[p95Idx],
    p99LatencyMs: latencies[p99Idx],
    averageLatencyMs: Math.round(totalLatency / totalCases),
    totalInputTokens,
    totalOutputTokens,
    totalTokens,
    estimatedCostUsd: Math.round(estimatedCostUsd * 10000) / 10000,
  };
}

export function calculateExperimentMetrics(
  experimentId: string,
  results: ExperimentCaseResultRecord[],
): ExperimentMetricsSummary {
  const choiceMetrics: Record<string, ChoiceMetric> = {};
  for (const q of CHOICE_QUESTIONS) {
    choiceMetrics[q] = calculateChoiceMetric(q, results);
  }

  const booleanMetrics: Record<string, BooleanMetric> = {};
  for (const q of BOOLEAN_QUESTIONS) {
    booleanMetrics[q] = calculateBooleanMetric(q, results);
  }

  const scoreMetrics: Record<string, ScoreMetric> = {};
  for (const q of SCORE_QUESTIONS) {
    scoreMetrics[q] = calculateScoreMetric(q, results);
  }

  const business = calculateBusinessMetrics(results);
  const performance = calculatePerformanceMetrics(results);

  return {
    experimentId,
    totalCases: results.length,
    business,
    performance,
    choiceMetrics,
    booleanMetrics,
    scoreMetrics,
  };
}
