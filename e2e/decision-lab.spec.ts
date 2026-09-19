import { expect, test } from '@playwright/test';

test('operator views Decision Lab metrics, filters slices, simulates policy and manages versions', async ({ page }) => {
  // 1. Visit Decision Lab
  await page.goto('/decision-lab');
  await expect(page.getByRole('heading', { name: 'Decision Lab' })).toBeVisible();
  await expect(page.getByText('Pre-evaluated Baseline')).toBeVisible();

  // 2. Slice filtering test
  await expect(page.getByText('当前切片样本: 30 案')).toBeVisible();
  await page.getByRole('button', { name: '中文案件 (12 案)' }).click();
  await expect(page.getByText('当前切片样本: 12 案')).toBeVisible();

  // Return to all cases
  await page.getByRole('button', { name: '全部案件 (30 案)' }).click();
  await expect(page.getByText('当前切片样本: 30 案')).toBeVisible();

  // 3. Check visualizations exist
  await expect(page.getByText('退款意图校准图 (ECE Reliability)')).toBeVisible();
  await expect(page.getByText('部门路由分类准确度')).toBeVisible();
  await expect(page.getByText('策略覆盖与风险分布')).toBeVisible();
  await expect(page.getByText('系统延迟与 Token 经济学')).toBeVisible();

  // 4. Policy Simulator
  await expect(page.getByText('策略模拟器 (Zero-cost Policy Simulator)')).toBeVisible();
  const saveBtn = page.getByRole('button', { name: '另存为新策略...' });
  await saveBtn.click();

  await page.getByLabel('策略版本号 (ID)').fill('resolveops-policy-e2e-v2');
  await page.getByLabel('策略名称').fill('E2E Test Policy');
  await page.getByRole('button', { name: '确认发布策略' }).click();

  await expect(page.getByText('策略版本已成功保存并入库')).toBeVisible();

  // 5. Navigate to Policies page and verify
  await page.goto('/policies');
  await expect(page.getByRole('heading', { name: 'Policy Repository' })).toBeVisible();
  await expect(page.getByText('E2E Test Policy')).toBeVisible();
  await expect(page.getByText('resolveops-policy-e2e-v2')).toBeVisible();
});
