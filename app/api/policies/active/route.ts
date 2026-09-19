import { join } from 'node:path';
import { openDatabase } from '../../../../src/db/client';
import * as policyRepo from '../../../../src/db/policy-repository';

const defaultDatabasePath = process.env.RESOLVEOPS_DB_PATH ?? join(process.cwd(), 'data', 'resolveops.sqlite');
function getDefaultRepo() {
  const db = openDatabase(defaultDatabasePath);
  return {
    findActivePolicy: () => policyRepo.findActivePolicy(db),
    setActivePolicy: (v: string) => policyRepo.setActivePolicy(db, v),
  };
}

export function createGetActivePolicyHandler(repo = getDefaultRepo()) {
  return async function GET(): Promise<Response> {
    const activePolicy = repo.findActivePolicy();
    return Response.json({ activePolicy });
  };
}

export function createSetActivePolicyHandler(repo = getDefaultRepo()) {
  return async function POST(request: Request): Promise<Response> {
    try {
      const body = await request.json().catch(() => ({}));
      if (!body.version) {
        return Response.json({ error: { code: 'VERSION_REQUIRED' } }, { status: 400 });
      }

      repo.setActivePolicy(body.version);
      const updated = repo.findActivePolicy();
      return Response.json({ activePolicy: updated }, { status: 200 });
    } catch (error) {
      if (error instanceof Error && error.message === 'POLICY_VERSION_NOT_FOUND') {
        return Response.json({ error: { code: error.message } }, { status: 404 });
      }
      return Response.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
    }
  };
}

export const GET = createGetActivePolicyHandler();
export const POST = createSetActivePolicyHandler();
