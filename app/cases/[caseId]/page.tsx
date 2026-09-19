import { notFound } from 'next/navigation';

import { CaseWorkspace } from '../../../components/case-workspace';
import { getDemoCase } from '../../../src/fixtures/cases';
import { defaultCaseService } from '../../../src/services/case-service';

export default async function CasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const caseFixture = getDemoCase(caseId);
  if (!caseFixture) notFound();
  const initialState = defaultCaseService.getCaseWorkspaceState(caseFixture.id);
  return <CaseWorkspace caseFixture={caseFixture} initialState={initialState} />;
}
