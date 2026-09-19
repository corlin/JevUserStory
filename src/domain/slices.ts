import type { CaseFixture } from './types';

export function filterCasesBySlice(cases: readonly CaseFixture[], slice: string): CaseFixture[] {
  if (!slice || slice === 'all') return [...cases];

  if (slice.startsWith('language:')) {
    const lang = slice.replace('language:', '');
    return cases.filter((c) => c.language === lang);
  }

  if (slice.startsWith('tag:')) {
    const tag = slice.replace('tag:', '');
    return cases.filter((c) => c.sliceTags.includes(tag));
  }

  if (slice.startsWith('tier:')) {
    const tier = slice.replace('tier:', '');
    return cases.filter((c) => c.customer.tier.toLowerCase() === tier.toLowerCase());
  }

  return [...cases];
}
