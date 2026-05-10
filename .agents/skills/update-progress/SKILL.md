---
name: update-progress
description: Updates progressLogs.md with one complete daily entry in the repository's existing format. Use when the user explicitly asks at session end to log that day's completed work and provides next steps to include.
---

# Update Progress

Writes a single end-of-day `progressLogs.md` update that matches the established Memoria format exactly.

## Use This Skill When

- The user explicitly asks to update `progressLogs.md`.
- The user indicates session wrap-up or end-of-day logging.
- The user provides next steps they want added.

## Hard Rules

- Never run this skill unless the user explicitly requests a `progressLogs.md` update.
- Never create partial/incremental logs during implementation.
- Log only completed work for that day; do not include planned-but-unfinished items.
- Keep wording aligned with existing style: plain-language, impact-focused, and grouped by headings.

## Required Inputs Before Writing

1. Date to log (use today's date unless user says otherwise).
2. Completed work items from this session/day.
3. The exact next steps the user wants included.
4. Any "things to flag for next session" notes surfaced by the main agent or subagents during the thread (warnings, deferred work, known issues, follow-ups, caveats, blockers).

If any input is missing, ask a concise clarification before editing.

## Capturing Flags for Next Session

Before drafting the entry, scan the thread (including subagent results) for any statements such as:

- "things to flag for next session"
- "flag for next session"
- "to flag"
- "follow-up", "follow up needed", "deferred"
- "known issue", "caveat", "watch out", "heads up"
- "TODO for next time", "leave for next session"

If any are found, include them verbatim (or lightly cleaned for grammar) in a dedicated `### Flags for Next Session` section placed immediately before `### Next Steps`. If nothing was flagged, omit the section entirely — do not invent items.

## Output Format Requirements

Match `progressLogs.md` conventions:

1. Date heading as `## <Month> <D>, <YYYY>`.
2. Section headings as `### <Area>`.
3. Bullet list items describing completed work.
4. Optional `### Flags for Next Session` section (only if any were surfaced) with bullet items.
5. Optional `### Next Steps` section with numbered list, using the user-provided steps.
6. Preserve separator style using `---` between date blocks when appropriate.

## Workflow

1. Read the end of `progressLogs.md` to copy exact formatting patterns.
2. Scan the thread (main agent + subagent results) for any "flag for next session" style notes.
3. Draft a single grouped entry for the day from completed work only.
4. If flags were found, add a `### Flags for Next Session` section before `### Next Steps`.
5. Insert the user-provided next steps verbatim or near-verbatim for clarity.
6. Append the entry at the end of `progressLogs.md`.
7. Re-read the appended section to verify heading style, bullets, numbering, and spacing match prior entries.

## Quality Checklist

1. Date format matches existing entries.
2. Only completed work is logged.
3. Any "flag for next session" notes from the thread (main agent or subagents) are captured under `### Flags for Next Session`.
4. Next steps are included exactly as requested by the user.
5. No unrelated files were edited.
6. `progressLogs.md` remains consistent and readable.
