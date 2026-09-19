import { AppShell } from '../../components/app-shell';
import { DecisionLabView } from '../../components/decision-lab/decision-lab-view';
import { DEMO_CASES } from '../../src/fixtures/cases';
import { defaultExperimentService } from '../../src/services/experiment-service';
import { openDatabase } from '../../src/db/client';
import { findActivePolicy } from '../../src/db/policy-repository';
import { join } from 'node:path';

const defaultDatabasePath = process.env.RESOLVEOPS_DB_PATH ?? join(process.cwd(), 'data', 'resolveops.sqlite');

export const dynamic = 'force-dynamic';

export default async function DecisionLabPage() {
  const experiments = defaultExperimentService.listExperiments();
  const latestOrBaseline = experiments.find((experiment) => experiment.status === 'completed') ?? experiments[0];
  const details = defaultExperimentService.getExperimentDetails(latestOrBaseline.id)!;

  const db = openDatabase(defaultDatabasePath);
  const activePolicy = findActivePolicy(db);

  return (
    <AppShell>
      <DecisionLabView
        activePolicyThresholds={activePolicy?.thresholds}
        allCases={DEMO_CASES}
        initialExperiment={details.experiment}
        initialResults={details.results}
      />
    </AppShell>
  );
}
