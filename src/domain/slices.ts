import type { CaseFixture } from './types';

export function isSupportedDatasetSlice(cases: readonly CaseFixture[], slice: unknown): slice is string {
  if (typeof slice !== 'string') return false;
  if (slice === 'all') return true;

  if (slice.startsWith('language:')) {
    const language = slice.slice('language:'.length);
    return cases.some((item) => item.language === language);
  }
  if (slice.startsWith('tag:')) {
    const tag = slice.slice('tag:'.length);
    return cases.some((item) => item.sliceTags.includes(tag));
  }
  if (slice.startsWith('tier:')) {
    const tier = slice.slice('tier:'.length).toLowerCase();
    return cases.some((item) => item.customer.tier.toLowerCase() === tier);
  }

  return false;
}

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
