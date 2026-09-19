import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../../../src/db/client';
import * as policyRepo from '../../../src/db/policy-repository';

const defaultDatabasePath = process.env.RESOLVEOPS_DB_PATH ?? join(process.cwd(), 'data', 'resolveops.sqlite');
function getDefaultRepo() {
  const db = openDatabase(defaultDatabasePath);
  return {
    listPolicyVersions: () => policyRepo.listPolicyVersions(db),
    savePolicyVersion: (p: any) => policyRepo.savePolicyVersion(db, p),
    findActivePolicy: () => policyRepo.findActivePolicy(db),
    setActivePolicy: (v: string) => policyRepo.setActivePolicy(db, v),
  };
}

export function createListPoliciesHandler(repo = getDefaultRepo()) {
  return async function GET(): Promise<Response> {
    const policies = repo.listPolicyVersions();
    return Response.json({ policies });
  };
}

export function createSavePolicyHandler(repo = getDefaultRepo()) {
  return async function POST(request: Request): Promise<Response> {
    try {
      const body = await request.json().catch(() => ({}));
      if (!body.version || !body.thresholds) {
        return Response.json({ error: { code: 'INVALID_POLICY_PAYLOAD' } }, { status: 400 });
      }

      const policyRecord = {
        id: `POL-${Date.now()}-${randomUUID().slice(0, 4).toUpperCase()}`,
        version: body.version,
        name: body.name ?? body.version,
        description: body.description ?? '',
        thresholds: body.thresholds,
        isActive: false,
        createdAt: new Date().toISOString(),
      };

      const saved = repo.savePolicyVersion(policyRecord);
      return Response.json({ policy: saved }, { status: 201 });
    } catch {
      return Response.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
    }
  };
}

export const GET = createListPoliciesHandler();
export const POST = createSavePolicyHandler();
