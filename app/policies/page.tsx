import { join } from 'node:path';
import { AppShell } from '../../components/app-shell';
import { PoliciesView } from '../../components/policies/policies-view';
import { openDatabase } from '../../src/db/client';
import { listPolicyVersions } from '../../src/db/policy-repository';
import { seedBaselineEntities } from '../../src/services/experiment-service';

const defaultDatabasePath = process.env.RESOLVEOPS_DB_PATH ?? join(process.cwd(), 'data', 'resolveops.sqlite');

export default async function PoliciesPage() {
  const db = openDatabase(defaultDatabasePath);
  seedBaselineEntities(db);
  const policies = listPolicyVersions(db);

  return (
    <AppShell>
      <PoliciesView initialPolicies={policies} />
    </AppShell>
  );
}
