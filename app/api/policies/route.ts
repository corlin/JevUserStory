import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { openDatabase } from '../../../src/db/client';
import * as policyRepo from '../../../src/db/policy-repository';
import { PolicyVersionInputSchema } from '../../../src/policy/validation';

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
      const parsed = PolicyVersionInputSchema.safeParse(body);
      if (!parsed.success) {
        return Response.json({ error: { code: 'INVALID_POLICY_PAYLOAD' } }, { status: 400 });
      }

      const policyRecord = {
        id: `POL-${Date.now()}-${randomUUID().slice(0, 4).toUpperCase()}`,
        version: parsed.data.version,
        name: parsed.data.name ?? parsed.data.version,
        description: parsed.data.description ?? '',
        thresholds: parsed.data.thresholds,
        isActive: false,
        createdAt: new Date().toISOString(),
      };

      const saved = repo.savePolicyVersion(policyRecord);
      return Response.json({ policy: saved }, { status: 201 });
    } catch (error) {
      if (error instanceof Error && error.message === 'POLICY_VERSION_EXISTS') {
        return Response.json({ error: { code: error.message } }, { status: 409 });
      }
      return Response.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
    }
  };
}

export const GET = createListPoliciesHandler();
export const POST = createSavePolicyHandler();
