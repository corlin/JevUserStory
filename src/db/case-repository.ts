import type { CaseFixture } from '../domain/types';
import type { ResolveOpsDatabase } from './client';

type CaseRow = {
  fixture_json: string;
};

export type CaseFilters = {
  language?: CaseFixture['language'];
  tag?: string;
};

function parseCase(row: CaseRow): CaseFixture {
  return JSON.parse(row.fixture_json) as CaseFixture;
}

export function seedCases(database: ResolveOpsDatabase, fixtures: readonly CaseFixture[]): void {
  const insert = database.prepare(`
    INSERT OR IGNORE INTO cases (id, fixture_json, language, tags_json)
    VALUES (@id, @fixtureJson, @language, @tagsJson)
  `);
  const seed = database.transaction((items: readonly CaseFixture[]) => {
    for (const fixture of items) {
      insert.run({
        id: fixture.id,
        fixtureJson: JSON.stringify(fixture),
        language: fixture.language,
        tagsJson: JSON.stringify(fixture.sliceTags),
      });
    }
  });
  seed(fixtures);
}

export function listCases(database: ResolveOpsDatabase, filters: CaseFilters = {}): CaseFixture[] {
  const clauses: string[] = [];
  const parameters: Record<string, string> = {};

  if (filters.language) {
    clauses.push('language = @language');
    parameters.language = filters.language;
  }
  if (filters.tag) {
    clauses.push('EXISTS (SELECT 1 FROM json_each(tags_json) WHERE value = @tag)');
    parameters.tag = filters.tag;
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = database.prepare(`SELECT fixture_json FROM cases ${where} ORDER BY id`).all(parameters) as CaseRow[];
  return rows.map(parseCase);
}

export function findCase(database: ResolveOpsDatabase, caseId: string): CaseFixture | undefined {
  if (!/^DEMO-\d{3}$/.test(caseId)) return undefined;
  const row = database.prepare('SELECT fixture_json FROM cases WHERE id = ?').get(caseId) as CaseRow | undefined;
  return row ? parseCase(row) : undefined;
}
