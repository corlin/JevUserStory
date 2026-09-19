export const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS cases (
    id TEXT PRIMARY KEY,
    fixture_json TEXT NOT NULL,
    language TEXT NOT NULL,
    tags_json TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS evaluation_runs (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    model_id TEXT NOT NULL,
    question_version TEXT NOT NULL,
    answers_json TEXT NOT NULL,
    usage_json TEXT NOT NULL,
    latency_ms INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (case_id) REFERENCES cases(id)
  );

  CREATE TABLE IF NOT EXISTS policy_decisions (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL UNIQUE,
    policy_version TEXT NOT NULL,
    action TEXT NOT NULL,
    reason_codes_json TEXT NOT NULL,
    refund_cents INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (run_id) REFERENCES evaluation_runs(id)
  );

  CREATE TABLE IF NOT EXISTS review_decisions (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL UNIQUE,
    action TEXT NOT NULL,
    refund_cents INTEGER NOT NULL,
    note TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (case_id) REFERENCES cases(id)
  );

  CREATE TABLE IF NOT EXISTS reply_runs (
    id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    review_id TEXT NOT NULL,
    draft TEXT NOT NULL,
    verification_json TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (case_id) REFERENCES cases(id),
    FOREIGN KEY (review_id) REFERENCES review_decisions(id)
  );

  CREATE INDEX IF NOT EXISTS idx_cases_language ON cases(language);
  CREATE INDEX IF NOT EXISTS idx_evaluation_runs_case ON evaluation_runs(case_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_reviews_case ON review_decisions(case_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_replies_review ON reply_runs(review_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_replies_case ON reply_runs(case_id, created_at);
`;
