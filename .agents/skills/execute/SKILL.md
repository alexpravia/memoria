---
name: execute
description: Executes an existing implementation plan by delegating each step to parallel subagents, requiring each subagent to plan, implement, and test their assigned step, then runs final end-to-end validation before returning the completed result.
---

# Execute

Executes a previously created plan by splitting it into step-level subagent workstreams, running them concurrently, and validating all results before reporting completion.

## Use This Skill When

- The user says to "execute the plan" that already exists.
- The user wants every plan step delegated to subagents.
- The user wants parallel implementation and comprehensive testing.

## Required Outcomes

1. Every plan step is assigned to a dedicated subagent thread.
2. Every subagent creates a brief step-specific plan before coding.
3. Subagents implement and test their step completely.
4. The primary thread runs final, full validation across all combined changes.
5. The user receives a functional implementation summary with test evidence.

## Workflow

1. Confirm the source plan and extract explicit, atomic steps with completion criteria.
2. Convert each step into a subagent goal that requires: mini-plan, implementation, and testing.
3. Launch one handoff per step as quickly as possible so work runs concurrently.
4. Track all thread IDs and assigned steps in a checklist in the main thread notes.
5. Monitor subagent progress and results, then unblock or re-delegate as needed.
6. Verify each step locally in the main thread after subagent completion.
7. Run full project validation (lint/typecheck/tests/build plus relevant smoke checks).
8. Fix any integration or regression issues before reporting completion.
9. Return a concise implementation summary, test results, and any residual risks.

## Subagent Goal Template

Use this handoff goal format for each step:

```text
Execute Step <N>: <step title>.
First create a short implementation plan for this step, then implement it fully.
Run all relevant tests (and add/adjust tests if coverage is missing), verify behavior end-to-end,
and report: files changed, commands run, test outcomes, and any follow-up needed.
Do not stop at analysis.
```

## Execution Rules

- Prefer parallel handoffs for independent steps.
- Keep each subagent scoped to one step to avoid overlap and merge conflicts.
- Require concrete test output from every subagent; do not accept "should work".
- If a step has no automated tests, require explicit manual verification steps.
- Re-run full validation after integrating all step outputs.
- Do not declare success unless final integrated validation passes.

## Final Response Checklist

1. List implemented plan steps and where each was completed.
2. Report subagent testing evidence per step.
3. Report final integrated test suite results.
4. Confirm functional status, or clearly list remaining blockers.
