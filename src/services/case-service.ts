import { randomUUID } from 'node:crypto';
import { join } from 'node:path';

import type { CaseFixture, EvaluationOutcome, EvaluationRecord, PolicyDecision } from '../domain/types';
import { findCase, listCases, seedCases, type CaseFilters } from '../db/case-repository';
import { openDatabase, type ResolveOpsDatabase } from '../db/client';
import {
  saveEvaluationRun,
  savePolicyDecision,
  type PolicyDecisionRecord,
} from '../db/run-repository';
import { DEMO_CASES } from '../fixtures/cases';
import { evaluateCase } from '../gateway/evaluate-case';
import { evaluatePolicy } from '../policy/evaluate-policy';

export type CaseEvaluationResult = {
  run: EvaluationRecord;
  policyDecision: PolicyDecisionRecord;
};

export type CaseService = {
  listCases(filters?: CaseFilters): CaseFixture[];
  evaluateAndPersistCase(caseId: string): Promise<CaseEvaluationResult>;
};

type CaseServiceDependencies = {
  findCase(caseId: string): CaseFixture | undefined;
  listCases(filters?: CaseFilters): CaseFixture[];
  evaluateCase(state: string, options: { caseId: CaseFixture['id'] }): Promise<EvaluationRecord>;
  saveEvaluationRun(record: EvaluationRecord): EvaluationRecord;
  evaluatePolicy(caseFixture: CaseFixture, outcome: EvaluationOutcome): PolicyDecision;
  savePolicyDecision(decision: PolicyDecisionRecord): PolicyDecisionRecord;
  createId(): string;
  now(): Date;
};

function buildEvaluationState(caseFixture: CaseFixture): string {
  return JSON.stringify({
    customer: caseFixture.customer,
    order: caseFixture.order,
    payments: caseFixture.payments,
    shipment: caseFixture.shipment,
    refundPolicy: caseFixture.refundPolicy,
  });
}

export function createCaseService(dependencies: CaseServiceDependencies): CaseService {
  return {
    listCases(filters = {}) {
      return dependencies.listCases(filters);
    },

    async evaluateAndPersistCase(caseId) {
      if (!/^DEMO-\d{3}$/.test(caseId)) throw new Error('CASE_NOT_FOUND');
      const caseFixture = dependencies.findCase(caseId);
      if (!caseFixture) throw new Error('CASE_NOT_FOUND');

      const run = await dependencies.evaluateCase(buildEvaluationState(caseFixture), {
        caseId: caseFixture.id,
      });
      dependencies.saveEvaluationRun(run);

      const policy = dependencies.evaluatePolicy(caseFixture, run.outcome);
      const policyDecision = dependencies.savePolicyDecision({
        ...policy,
        id: dependencies.createId(),
        runId: run.id,
        createdAt: dependencies.now().toISOString(),
      });

      return { run, policyDecision };
    },
  };
}

let defaultDatabase: ResolveOpsDatabase | undefined;
let resolvedDefaultService: CaseService | undefined;

export function getDefaultDatabase(): ResolveOpsDatabase {
  defaultDatabase ??= openDatabase(join(process.cwd(), 'data', 'resolveops.sqlite'));
  seedCases(defaultDatabase, DEMO_CASES);
  return defaultDatabase;
}

function getResolvedDefaultService(): CaseService {
  if (resolvedDefaultService) return resolvedDefaultService;
  const database = getDefaultDatabase();
  resolvedDefaultService = createCaseService({
    findCase: (caseId) => findCase(database, caseId),
    listCases: (filters) => listCases(database, filters),
    evaluateCase,
    saveEvaluationRun: (record) => saveEvaluationRun(database, record),
    evaluatePolicy,
    savePolicyDecision: (record) => savePolicyDecision(database, record),
    createId: randomUUID,
    now: () => new Date(),
  });
  return resolvedDefaultService;
}

export const defaultCaseService: CaseService = {
  listCases: (filters) => getResolvedDefaultService().listCases(filters),
  evaluateAndPersistCase: (caseId) => getResolvedDefaultService().evaluateAndPersistCase(caseId),
};
