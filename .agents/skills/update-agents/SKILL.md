---
name: update-agents
description: Updates AGENTS.md with the current working thread and refreshed current-status context. Use when the user asks to sync AGENTS.md to the latest project thread, recent fixes, or startup context.
---

# updateAGENTS

Refreshes `AGENTS.md` so future sessions start with the latest working thread and accurate current project status.

## Use This Skill When

- The user asks to update `AGENTS.md` with the latest thread.
- The user wants startup context refreshed after a substantial work session.
- The user says to sync thread context, current status, or recent fixes into `AGENTS.md`.

## Hard Rules

- Update `AGENTS.md` only when the user explicitly asks.
- Prefer updating only the thread reference, current status, recent fixes, and closely related context sections.
- Do not overwrite durable project overview sections unless they are now clearly inaccurate.
- Do not update `progress.md` unless the user separately asks for that.

## Workflow

1. Read the current `AGENTS.md` and the latest relevant work context from the active thread.
2. Add the current thread to the thread reference section with a concise summary.
3. Refresh the `Current Status` date and bullets so they match the latest completed work.
4. Update any `Recent fixes` section so it reflects the newest implemented work and thread ID.
5. Keep formatting, tone, and section structure consistent with the existing file.
6. Re-read the updated section to verify the file remains compact, accurate, and useful on startup.

## Quality Checklist

1. The current working thread is recorded in `AGENTS.md`.
2. `Current Status` reflects the latest completed implementation state.
3. `Recent fixes` mentions the newest thread and the most important completed fixes.
4. Older historical context remains intact unless it is superseded or clearly outdated.
5. `AGENTS.md` stays concise enough to be practical startup context.
