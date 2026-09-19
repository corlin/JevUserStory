import { notFound } from 'next/navigation';

import { CaseWorkspace } from '../../../components/case-workspace';
import { getDemoCase } from '../../../src/fixtures/cases';

export default async function CasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const caseFixture = getDemoCase(caseId);
  if (!caseFixture) notFound();
  return <CaseWorkspace caseFixture={caseFixture} />;
}
