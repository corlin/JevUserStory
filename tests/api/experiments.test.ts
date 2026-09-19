import { describe, expect, it } from 'vitest';
import { createExperimentsListHandler, createRunExperimentHandler } from '../../app/api/experiments/route';
import { createGetExperimentDetailsHandler } from '../../app/api/experiments/[id]/route';
import { createListPoliciesHandler, createSavePolicyHandler } from '../../app/api/policies/route';
import { createGetActivePolicyHandler, createSetActivePolicyHandler } from '../../app/api/policies/active/route';
import { POLICY_V1 } from '../../src/policy/policy-v1';

describe('experiments api routes', () => {
  const fakeService = {
    listExperiments() {
      return [
        {
          id: 'EXP-1',
          modelId: 'typesafe-ai/jev',
          questionVersion: 'resolveops-questions-v1',
          policyVersion: 'resolveops-policy-v1',
          datasetSlice: 'all',
          status: 'completed' as const,
          sourceType: 'baseline' as const,
          totalCases: 30,
          completedCases: 30,
          createdAt: new Date().toISOString(),
        },
      ];
    },
    async runExperiment(options: any) {
      return {
        id: 'EXP-NEW',
        modelId: 'typesafe-ai/jev',
        questionVersion: 'resolveops-questions-v1',
        policyVersion: 'resolveops-policy-v1',
        datasetSlice: options.datasetSlice ?? 'all',
        status: 'completed' as const,
        sourceType: options.sourceType ?? 'baseline' as const,
        totalCases: 30,
        completedCases: 30,
        createdAt: new Date().toISOString(),
      };
    },
    getExperimentDetails(id: string) {
      if (id !== 'EXP-1') return undefined;
      return {
        experiment: this.listExperiments()[0],
        results: [],
        metrics: {
          experimentId: 'EXP-1',
          totalCases: 0,
          business: { totalCases: 0, autoCount: 0, autoRate: 0, confirmCount: 0, confirmRate: 0, reviewCount: 0, reviewRate: 0, blockCount: 0, blockRate: 0, falseAutomationCount: 0, falseAutomationRate: 0 },
          performance: { p50LatencyMs: 0, p95LatencyMs: 0, p99LatencyMs: 0, averageLatencyMs: 0, totalInputTokens: 0, totalOutputTokens: 0, totalTokens: 0, estimatedCostUsd: 0 },
          choiceMetrics: {},
          booleanMetrics: {},
          scoreMetrics: {},
        },
      };
    },
  };

  it('lists experiments and creates a new experiment', async () => {
    const listHandler = createExperimentsListHandler(fakeService as any);
    const getRes = await listHandler();
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.experiments).toHaveLength(1);

    const postHandler = createRunExperimentHandler(fakeService as any);
    const postRes = await postHandler(
      new Request('http://localhost/api/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datasetSlice: 'language:en', sourceType: 'baseline' }),
      }),
    );
    expect(postRes.status).toBe(201);
    const postBody = await postRes.json();
    expect(postBody.experiment.id).toBe('EXP-NEW');
  });

  it('gets experiment details by id and returns 404 for unknown', async () => {
    const detailsHandler = createGetExperimentDetailsHandler(fakeService as any);

    const okRes = await detailsHandler(new Request('http://localhost/api/experiments/EXP-1'), {
      params: Promise.resolve({ id: 'EXP-1' }),
    });
    expect(okRes.status).toBe(200);

    const notFoundRes = await detailsHandler(new Request('http://localhost/api/experiments/EXP-404'), {
      params: Promise.resolve({ id: 'EXP-404' }),
    });
    expect(notFoundRes.status).toBe(404);
  });
});

describe('policies api routes', () => {
  let activePolicy = {
    id: 'POL-1',
    version: 'resolveops-policy-v1',
    name: 'Policy v1',
    thresholds: POLICY_V1,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  const fakePolicyRepo = {
    listPolicyVersions() {
      return [activePolicy];
    },
    savePolicyVersion(p: any) {
      return p;
    },
    findActivePolicy() {
      return activePolicy;
    },
    setActivePolicy(ver: string) {
      activePolicy = { ...activePolicy, version: ver };
    },
  };

  it('lists, creates, and toggles active policy', async () => {
    const listHandler = createListPoliciesHandler(fakePolicyRepo as any);
    const getRes = await listHandler();
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.policies).toHaveLength(1);

    const saveHandler = createSavePolicyHandler(fakePolicyRepo as any);
    const saveRes = await saveHandler(
      new Request('http://localhost/api/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: 'resolveops-policy-v2',
          name: 'Policy v2',
          thresholds: { ...POLICY_V1, refundAutoMinimum: 0.95 },
        }),
      }),
    );
    expect(saveRes.status).toBe(201);

    const activeGetHandler = createGetActivePolicyHandler(fakePolicyRepo as any);
    const activeGetRes = await activeGetHandler();
    expect(activeGetRes.status).toBe(200);

    const activeSetHandler = createSetActivePolicyHandler(fakePolicyRepo as any);
    const activeSetRes = await activeSetHandler(
      new Request('http://localhost/api/policies/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: 'resolveops-policy-v2' }),
      }),
    );
    expect(activeSetRes.status).toBe(200);
  });
});
