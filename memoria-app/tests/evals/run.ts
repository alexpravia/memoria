// Eval harness entry point.
//
// Loads every `*.eval.json` file under `tests/evals/`, runs them against
// the assistant LLM, and prints a pass/fail summary.
//
// Phase 0: discovery only — no LLM is actually called yet. Phase C will
// add the real runner (model invocation + assertion engine including the
// `judge` assertion).

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

type AssertionType = "substring" | "regex" | "no_substring" | "judge";

interface EvalAssertion {
  type: AssertionType;
  value: string;
  // optional fields used by `judge` assertions
  rubric?: string;
  threshold?: number;
}

interface EvalSpec {
  name: string;
  input: string;
  model?: string;
  runs?: number;
  assertions: EvalAssertion[];
}

const here = dirname(fileURLToPath(import.meta.url));

function loadEvals(dir: string): { file: string; spec: EvalSpec }[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(".eval.json"))
    .map((name) => {
      const file = join(dir, name);
      const spec = JSON.parse(readFileSync(file, "utf8")) as EvalSpec;
      return { file, spec };
    });
}

async function main(): Promise<void> {
  const evals = loadEvals(here);

  if (evals.length === 0) {
    console.log("no evals to run yet");
    return;
  }

  console.log(`Discovered ${evals.length} eval file(s):`);
  for (const { file, spec } of evals) {
    console.log(`  • ${spec.name}  (${file})`);
  }
  console.log("");
  console.log(
    "⚠️  Phase 0: eval runner is discovery-only. " +
      "Wire up model invocation + assertion engine in Phase C."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
