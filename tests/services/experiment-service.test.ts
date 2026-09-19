import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../../src/db/client';
import { seedCases } from '../../src/db/case-repository';
import { DEMO_CASES } from '../../src/fixtures/cases';
import {
  createExperimentService,
  defaultExperimentService,
} from '../../src/services/experiment-service';

const temporaryDirectories: string[] = [];

function createTestDatabase() {
  const directory = mkdtempSync(join(tmpdir(), 'resolveops-exp-serv-'));
  temporaryDirectories.push(directory);
  const database = openDatabase(join(directory, 'test.sqlite'));
  seedCases(database, DEMO_CASES);
  return database;
}

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    rmSync(temporaryDirectories.pop()!, { recursive: true, force: true });
  }
});

describe('experiment service', () => {
  it('seeds default baseline experiment and returns metrics out-of-the-box', () => {
    const database = createTestDatabase();
    const service = createExperimentService(database);

    // Initial check: seeds baseline automatically
    const experiments = service.listExperiments();
    expect(experiments.length).toBeGreaterThanOrEqual(1);

    const baseline = experiments.find((e) => e.sourceType === 'baseline');
    expect(baseline).toBeDefined();
    expect(baseline?.status).toBe('completed');
    expect(baseline?.totalCases).toBe(30);

    const details = service.getExperimentDetails(baseline!.id);
    expect(details).toBeDefined();
    expect(details?.results).toHaveLength(30);
    expect(details?.metrics.totalCases).toBe(30);
    expect(details?.metrics.business.autoRate).toBeGreaterThan(0);
    expect(details?.metrics.choiceMetrics.department.accuracy).toBeGreaterThan(0.7);

    database.close();
  });

  it('runs a new experiment with custom slice', async () => {
    const database = createTestDatabase();
    const service = createExperimentService(database);

    const newExperiment = await service.runExperiment({
      datasetSlice: 'language:zh-CN',
      sourceType: 'baseline',
    });

    expect(newExperiment.status).toBe('completed');
    expect(newExperiment.datasetSlice).toBe('language:zh-CN');
    expect(newExperiment.totalCases).toBe(12); // 12 Chinese cases in 30 demo cases

    const details = service.getExperimentDetails(newExperiment.id);
    expect(details?.results).toHaveLength(12);
    expect(details?.metrics.totalCases).toBe(12);

    database.close();
  });
});
