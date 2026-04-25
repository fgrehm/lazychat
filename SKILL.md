---
name: lazychat
description: Collaborate with the user asynchronously through a shared markdown file in the working tree. The agent writes questions or proposals in the file and stops; the human replies at their own pace, freeform. Use when the user mentions "lazychat" or asks to "discuss in a file", when the task has several entangled decisions better thought through than chatted through, or when the user may want to step away and reply later. Do NOT use for single-question decisions, bug fixes, or when the user is actively present and driving.
---

# lazychat

A file-based async discussion protocol. A shared markdown file acts like an email thread: you write questions or proposals, stop, and the user replies at their own pace in the same file.

The key words MUST, MUST NOT, SHOULD, and MAY in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## How to operate it

1. **Confirm scope and context.** Before creating the file, you MUST have: the target artifact (what we want to ship), the core question or decision, and enough context to write round 1 without guessing. The prior chat counts as context; use what the human has already told you. If something needed is missing, ask in chat before creating the file.
2. **Create the file** at `.lazyai/YYYY-MM-DDTHHMM-<topic-slug>.md` in the current working tree, using the template below. Fill in the topic and the one-paragraph context comment.
3. **Write questions, proposals, or drafts** in the file. Freeform. Number points, quote options, include diffs, whatever serves clarity.
4. **Stop and tell the user in chat** that the file is ready at `<path>`. You MUST NOT keep writing past the current round.
5. **Wait.** The user may reply in minutes, hours, or days. Do not nudge.
6. **Re-read the file end-to-end** when the user signals they have replied or when resuming a thread. Do not skim. The file is the source of truth. If the next move isn't clear after re-reading, ask in chat or write a short refresher round stating where you think the thread stands; do not guess.
7. **Continue** in the same file. When the discussion has converged, write a final `## Outcome` section summarizing the decisions, flip frontmatter `status` to `converged`, and apply the outcome to the canonical artifact. The discussion file stays as the record.

## Template

Copy this into the new file:

```markdown
---
status: open
---

# <topic>

<!-- One paragraph: what we are figuring out, why it matters, and what the target artifact is. -->

---

<!-- Agent writes below. -->
```

## Conventions

- **Turn headers.** Each turn MUST start with `## Round N (agent)` or `## Round N (human)`. Agent turns SHOULD append `- @<model-id>` for attribution. If the model id is omitted, tooling may record the turn as `@unknown`.
- **Append, don't insert.** New turns MUST be added at the end of the file. Do not write above existing turns or at the top of the file.
- **No turn separators in your body.** The `---` line between turns is inserted for you. Do not write `---` separators inside a turn body; they make the file harder to scan.
- **Quote-and-reply.** When replying to specific lines, you SHOULD use `>` to quote the line or block, then write your reply below it.
- **Numbered questions.** When an agent turn has multiple questions, you SHOULD label them `**Q1.**` / `**Q2.**` so the human can quote and reply cleanly.
- **Long content.** You SHOULD wrap tool output, long code, or verbatim quotes in `<details><summary>...</summary>...</details>` to keep the reading flow clean.
- **HTML comments are agent-visible.** `<!-- ... -->` renders blank on GitHub but agents re-reading the file will see it. Useful for scaffolding; MUST NOT be used to hide content from the agent.

## Rules

- **The file is the record.** You MUST NOT duplicate its content into chat. Chat is only for "file is ready" and "file is done" signals.
- **Structure within a turn is optional.** Use numbered points, bulleted options, or quoted proposals when they serve clarity; prose otherwise.
- **No reply vocabulary.** The user MAY reply with "ok", "yes", "LGTM", "nice", freeform prose, inline edits, or a new section. Accept any clear affirmation.
- **Do not edit canonical artifacts before the discussion concludes.** You MUST NOT modify the target artifact (code, docs, etc.) until the thread has converged. The file exists so you can think without committing.
- **One file per topic.** You MUST create a new file for each new topic. Do not reset or reuse across unrelated topics.

## When not to use

- Single-question decisions (chat is faster).
- Code review (use `git diff` or a review tool).
- Tasks where the user is actively present and driving.
- Tasks with no branching decisions.
