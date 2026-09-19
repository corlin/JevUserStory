import { expect, test, type Page } from '@playwright/test';

function evaluationButton(page: Page) {
  return page.getByRole('button', { name: /运行.*(Jev|评估)|Jev.*运行/ });
}

const evaluationResult = {
  run: {
    id: 'e2e-run-1',
    caseId: 'DEMO-001',
    modelId: 'typesafe-ai/jev',
    questionVersion: 'resolveops-questions-v1',
    outcome: {
      status: 'valid',
      answers: {
        department: { type: 'choice', choice: 'billing', probabilities: { billing: 0.98, other: 0.02 }, topProbability: 0.98, topTwoMargin: 0.96 },
        requested_resolution: { type: 'choice', choice: 'refund', probabilities: { refund: 0.99, none: 0.01 }, topProbability: 0.99, topTwoMargin: 0.98 },
        refund_requested: { type: 'boolean', probability: 0.98 },
        urgent: { type: 'boolean', probability: 0.08 },
        policy_supports_action: { type: 'boolean', probability: 0.97 },
        prompt_injection: { type: 'boolean', probability: 0.91 },
        frustration: { type: 'score', score: 1.2, probabilities: { '0': 0.1, '1': 0.7, '2': 0.2, '3': 0 } },
        severity: { type: 'score', score: 2, probabilities: { '0': 0, '1': 0.1, '2': 0.8, '3': 0.1 } },
        evidence_quality: { type: 'score', score: 2.8, probabilities: { '0': 0, '1': 0, '2': 0.2, '3': 0.8 } },
      },
    },
    usage: { inputTokens: 100, outputTokens: 40, totalTokens: 140 },
    latencyMs: 120,
    createdAt: '2026-09-20T00:00:00.000Z',
  },
  policyDecision: {
    id: 'e2e-policy-1', runId: 'e2e-run-1', action: 'review',
    reasonCodes: ['PROMPT_INJECTION_REVIEW'], proposedRefundCents: 0,
    policyVersion: 'resolveops-policy-v1', createdAt: '2026-09-20T00:00:00.000Z',
  },
};

test('operator completes a safe simulated case workflow', async ({ page }) => {
  await page.route('**/api/cases/DEMO-001/evaluate', (route) => route.fulfill({ json: evaluationResult }));
  await page.route('**/api/cases/DEMO-001/review', (route) => route.fulfill({
    status: 201,
    json: {
      id: 'e2e-review-1', caseId: 'DEMO-001', idempotencyKey: 'e2e-idempotency',
      action: 'modify_refund', refundCents: 2400, note: 'Approved partial refund',
      createdAt: '2026-09-20T00:01:00.000Z', simulation: true,
    },
  }));
  await page.route('**/api/cases/DEMO-001/reply', (route) => route.fulfill({
    json: {
      id: 'e2e-reply-1', caseId: 'DEMO-001', reviewId: 'e2e-review-1',
      draft: 'We approved a $24.00 partial refund for the duplicate charge.',
      verification: {
        status: 'review_required',
        answers: {
          exceeds_approved_action: { probability: 0.05 },
          contradicts_refund_policy: { probability: 0.04 },
          exposes_internal_details: { probability: 0.01 },
        },
        reasonCodes: ['EXCEEDS_APPROVED_ACTION'],
      },
      status: 'review_required', createdAt: '2026-09-20T00:02:00.000Z',
    },
  }));

  await page.goto('/cases');
  await page.getByRole('button', { name: '中文案件' }).click();
  await expect(page.getByText('zh-CN').first()).toBeVisible();
  await expect(page.getByText('DEMO-001', { exact: true })).toBeHidden();
  await page.getByRole('button', { name: '全部案件' }).click();
  await page.getByRole('link', { name: '打开 DEMO-001' }).click();

  await expect(page.getByRole('button', { name: '运行 Jev 评估' })).toBeVisible();
  await evaluationButton(page).click();
  await expect(page.getByText('Policy action: review')).toBeVisible();
  await expect(page.getByText('PROMPT_INJECTION_REVIEW')).toBeVisible();

  await page.getByLabel('退款金额（美分）').fill('2400');
  await page.getByLabel('审核备注').fill('Approved partial refund');
  await page.getByRole('button', { name: '修改退款' }).click();
  await expect(page.getByText('模拟决定已记录；未执行真实退款')).toBeVisible();

  await page.getByRole('button', { name: '生成并验证客户回复' }).click();
  await expect(page.getByText('We approved a $24.00 partial refund for the duplicate charge.')).toBeVisible();
  await expect(page.getByText('review_required', { exact: true })).toBeVisible();
  await expect(page.getByText('EXCEEDS_APPROVED_ACTION')).toBeVisible();
  await expect(page.getByText('模拟操作 · 不执行真实退款')).toBeVisible();
});

test('unknown cases use the not-found boundary', async ({ page }) => {
  const response = await page.goto('/cases/DEMO-999');
  expect(response?.status()).toBe(404);
});

for (const code of ['GATEWAY_AUTHENTICATION_FAILED', 'GATEWAY_RATE_LIMITED'] as const) {
  test(`shows the stable ${code} state`, async ({ page }) => {
    await page.route('**/api/cases/DEMO-001/evaluate', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      await route.fulfill({ status: 502, json: { error: { code } } });
    });
    await page.goto('/cases/DEMO-001');
    await evaluationButton(page).click();
    await expect(page.getByRole('button', { name: '正在评估…' })).toBeDisabled();
    await expect(page.getByText(code)).toBeVisible();
    await expect(page.getByRole('button', { name: '重新运行评估' })).toBeVisible();
  });
}

test('malformed model output fails closed to review', async ({ page }) => {
  await page.route('**/api/cases/DEMO-001/evaluate', (route) => route.fulfill({
    json: {
      ...evaluationResult,
      run: {
        ...evaluationResult.run,
        outcome: { status: 'invalid', errorCode: 'INVALID_EVALUATION_RESPONSE' },
      },
      policyDecision: {
        ...evaluationResult.policyDecision,
        reasonCodes: ['INVALID_EVALUATION_RESPONSE'],
      },
    },
  }));
  await page.goto('/cases/DEMO-001');
  await evaluationButton(page).click();
  await expect(page.getByText('INVALID_EVALUATION_RESPONSE').first()).toBeVisible();
  await expect(page.getByText('Policy action: review')).toBeVisible();
});
