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

  CREATE TABLE IF NOT EXISTS experiments (
    id TEXT PRIMARY KEY,
    model_id TEXT NOT NULL,
    question_version TEXT NOT NULL,
    policy_version TEXT NOT NULL,
    dataset_slice TEXT NOT NULL,
    status TEXT NOT NULL,
    source_type TEXT NOT NULL,
    total_cases INTEGER NOT NULL,
    completed_cases INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    finished_at TEXT
  );

  CREATE TABLE IF NOT EXISTS experiment_case_results (
    id TEXT PRIMARY KEY,
    experiment_id TEXT NOT NULL,
    case_id TEXT NOT NULL,
    answers_json TEXT NOT NULL,
    ground_truth_json TEXT NOT NULL,
    latency_ms INTEGER NOT NULL,
    usage_json TEXT NOT NULL,
    policy_action TEXT NOT NULL,
    reason_codes_json TEXT NOT NULL,
    refund_cents INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (experiment_id) REFERENCES experiments(id),
    FOREIGN KEY (case_id) REFERENCES cases(id)
  );

  CREATE TABLE IF NOT EXISTS question_set_versions (
    id TEXT PRIMARY KEY,
    version TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    questions_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS policy_versions (
    id TEXT PRIMARY KEY,
    version TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    thresholds_json TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_cases_language ON cases(language);
  CREATE INDEX IF NOT EXISTS idx_evaluation_runs_case ON evaluation_runs(case_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_reviews_case ON review_decisions(case_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_replies_review ON reply_runs(review_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_replies_case ON reply_runs(case_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_experiments_status ON experiments(status, created_at);
  CREATE INDEX IF NOT EXISTS idx_experiment_results ON experiment_case_results(experiment_id, case_id);
  CREATE INDEX IF NOT EXISTS idx_policy_versions_active ON policy_versions(is_active);
`;
