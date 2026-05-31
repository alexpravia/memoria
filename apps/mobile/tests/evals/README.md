# Assistant Evals

Behavioral regression tests for the Memoria AI assistant. Each eval is a
JSON file describing a single user turn and the assertions its response
must satisfy.

## Status

**Phase 0:** harness scaffolded; runner is discovery-only (it lists eval
files but does not call the LLM). Phase C will implement model
invocation, assertion checking, and the `judge` rubric.

## Running

```bash
npm run test:evals
```

## Eval JSON schema

Each file is named `<topic>.eval.json` and matches the following shape:

```jsonc
{
  "name": "human-readable label",
  "input": "the user's question or instruction",
  "model": "gpt-4o-mini",          // optional — defaults to the app's configured model
  "runs": 3,                        // optional — defaults to 1; multiple runs catch flakiness
  "assertions": [
    { "type": "substring",    "value": "Sarah" },
    { "type": "no_substring", "value": "I don't know" },
    { "type": "regex",        "value": "(?i)tomorrow|Tuesday" },
    {
      "type": "judge",
      "value": "Response is warm, gentle, and stays in second person.",
      "rubric": "Score 1-5; pass if >=4.",
      "threshold": 4
    }
  ]
}
```

### Assertion types

| Type            | Passes when                                                    |
| --------------- | -------------------------------------------------------------- |
| `substring`     | The response contains `value` (case-sensitive).                |
| `no_substring`  | The response does **not** contain `value`.                     |
| `regex`         | The response matches the JS regex source in `value`.           |
| `judge`         | A separate LLM call rates the response ≥ `threshold` per rubric. |

## Adding a new eval

1. Drop a new `*.eval.json` next to the others.
2. Keep `input` short and realistic — a single user turn.
3. Prefer `substring` / `no_substring` over `judge` when possible; judge
   assertions are slower and noisier.
4. Use `runs: 3` for any assertion sensitive to model temperature.
