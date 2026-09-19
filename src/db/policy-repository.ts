import type { ResolveOpsDatabase } from './client';
import type { PolicyVersionRecord } from '../domain/types';

type PolicyRow = {
  id: string;
  version: string;
  name: string;
  description: string | null;
  thresholds_json: string;
  is_active: number;
  created_at: string;
};

function mapPolicyRow(row: PolicyRow): PolicyVersionRecord {
  return {
    id: row.id,
    version: row.version,
    name: row.name,
    description: row.description ?? undefined,
    thresholds: JSON.parse(row.thresholds_json),
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  };
}

export function savePolicyVersion(
  database: ResolveOpsDatabase,
  policy: PolicyVersionRecord,
): PolicyVersionRecord {
  if (findPolicyVersion(database, policy.version)) {
    throw new Error('POLICY_VERSION_EXISTS');
  }
  const statement = database.prepare(`
    INSERT INTO policy_versions (
      id, version, name, description, thresholds_json, is_active, created_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?
    )
  `);

  statement.run(
    policy.id,
    policy.version,
    policy.name,
    policy.description ?? null,
    JSON.stringify(policy.thresholds),
    policy.isActive ? 1 : 0,
    policy.createdAt,
  );

  return policy;
}

export function findPolicyVersion(
  database: ResolveOpsDatabase,
  version: string,
): PolicyVersionRecord | undefined {
  const row = database.prepare('SELECT * FROM policy_versions WHERE version = ?').get(version) as PolicyRow | undefined;
  return row ? mapPolicyRow(row) : undefined;
}

export function findActivePolicy(database: ResolveOpsDatabase): PolicyVersionRecord | undefined {
  const row = database.prepare('SELECT * FROM policy_versions WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1').get() as PolicyRow | undefined;
  return row ? mapPolicyRow(row) : undefined;
}

export function listPolicyVersions(database: ResolveOpsDatabase): PolicyVersionRecord[] {
  const rows = database.prepare('SELECT * FROM policy_versions ORDER BY created_at DESC').all() as PolicyRow[];
  return rows.map(mapPolicyRow);
}

export function setActivePolicy(database: ResolveOpsDatabase, version: string): void {
  if (!findPolicyVersion(database, version)) {
    throw new Error('POLICY_VERSION_NOT_FOUND');
  }
  database.transaction(() => {
    database.prepare('UPDATE policy_versions SET is_active = 0').run();
    database.prepare('UPDATE policy_versions SET is_active = 1 WHERE version = ?').run(version);
  })();
}
