# Memoria Test Suite

Three layers, run independently:

| Layer        | Location                    | Speed | Needs creds? | Command                |
| ------------ | --------------------------- | ----- | ------------ | ---------------------- |
| Unit         | `src/**/*.test.ts`          | fast  | no           | `npm test`             |
| Integration  | `tests/integration/`        | slow  | yes          | `npm run test:integration` |
| Eval         | `tests/evals/*.eval.json`   | slow  | yes (LLM)    | `npm run test:evals`   |

## Unit tests

Pure-logic tests colocated with the code they exercise (e.g.
`src/lib/assistant.test.ts` next to `src/lib/assistant.ts`). They mock
Supabase via `vi.mock` and never hit the network. Required for every PR
via `scripts/check.sh`.

## Integration tests

Live in `tests/integration/`. They talk to a **dedicated** Supabase test
project — never your dev or prod project. They auto-skip when the
required env vars are missing so contributors without a test project can
still run `npm run check`.

Required env vars:

```bash
export SUPABASE_TEST_URL=https://<test-project>.supabase.co
export SUPABASE_TEST_SERVICE_KEY=<service_role_key>
```

The skip behaviour is implemented in
[`tests/helpers/skip-if-no-creds.ts`](./helpers/skip-if-no-creds.ts).
Tests should call `requireSupabaseTestCreds()` and pass `!creds` to
`it.skipIf(...)`.

Seed/teardown helpers live in [`tests/helpers/seed.ts`](./helpers/seed.ts).
They are skeletons in Phase 0 — Phase A will flesh them out.

## Evals

Behavioral regression tests for the LLM-backed assistant. See
[`tests/evals/README.md`](./evals/README.md) for the JSON schema and the
assertion types. Phase 0 ships a discovery-only runner; Phase C wires up
the actual model call and assertion engine.

## End-to-end (Maestro)

Maestro UI smoke flows under `.maestro/` are **paused** during the
AI-native migration. See [`.maestro/README.md`](../.maestro/README.md)
for the pause notice. Do not extend Maestro flows until the migration
work resumes.
