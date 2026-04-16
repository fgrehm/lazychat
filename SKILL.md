---
name: lazychat
description: Collaborate with the user asynchronously through a shared markdown file in the working tree. The agent writes questions or proposals in the file and stops; the human replies at their own pace, freeform. Use when the user mentions "lazychat" or asks to "discuss in a file", when the task has several entangled decisions better thought through than chatted through, or when the user may want to step away and reply later. Do NOT use for single-question decisions, bug fixes, or when the user is actively present and driving.
---

# lazychat

A file-based async discussion protocol. A shared markdown file acts like an email thread: you write questions or proposals, stop, and the user replies at their own pace in the same file.

## How to operate it

1. **Create the file** at `.lazyai/YYYY-MM-DDTHHMM-<topic-slug>.md` in the current working tree, using `templates/discussion.md` as the starting point. Fill in the topic and the one-paragraph context header.
2. **Write questions, proposals, or drafts** in the file. Freeform. Number points, quote options, include diffs, whatever serves clarity.
3. **Stop and tell the user in chat** that the file is ready at `<path>`. Do not keep writing past the current round.
4. **Wait.** The user may reply in minutes or hours. Do not nudge.
5. **Re-read the file end-to-end** when the user signals they have replied. Do not skim. The file is the source of truth.
6. **Continue** in the same file, or once the discussion has converged, apply the outcome to the canonical artifact (code, docs, etc.) and leave the discussion file as the record.

## Rules

- **The file is the record.** Do not duplicate its content into chat. Chat is only for "file is ready" and "file is done" signals.
- **Structure is optional.** Use numbered points, bulleted options, or quoted proposals when they serve clarity. Use freeform prose otherwise. Let the shape emerge from the topic, not from the template.
- **No reply vocabulary.** The user may reply with "ok", "yes", "LGTM", "nice", freeform prose, inline edits, or a new section. Accept any clear affirmation.
- **Do not edit canonical artifacts before the discussion concludes.** The file exists so you can think without committing.
- **One file per topic.** Do not reset or reuse across unrelated topics.

## When not to use

- Single-question decisions (chat is faster).
- Code review (use `git diff` or a review tool).
- Tasks where the user is actively present and driving.
- Tasks with no branching decisions.
