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

If any input is missing, ask a concise clarification before editing.

## Output Format Requirements

Match `progressLogs.md` conventions:

1. Date heading as `## <Month> <D>, <YYYY>`.
2. Section headings as `### <Area>`.
3. Bullet list items describing completed work.
4. Optional `### Next Steps` section with numbered list, using the user-provided steps.
5. Preserve separator style using `---` between date blocks when appropriate.

## Workflow

1. Read the end of `progressLogs.md` to copy exact formatting patterns.
2. Draft a single grouped entry for the day from completed work only.
3. Insert the user-provided next steps verbatim or near-verbatim for clarity.
4. Append the entry at the end of `progressLogs.md`.
5. Re-read the appended section to verify heading style, bullets, numbering, and spacing match prior entries.

## Quality Checklist

1. Date format matches existing entries.
2. Only completed work is logged.
3. Next steps are included exactly as requested by the user.
4. No unrelated files were edited.
5. `progressLogs.md` remains consistent and readable.
