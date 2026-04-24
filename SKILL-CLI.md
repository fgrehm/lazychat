---
name: lazychat
description: Collaborate with the user asynchronously through a shared markdown file in the working tree. The agent writes questions or proposals in the file and stops; the human replies at their own pace, freeform. Use when the user mentions "lazychat" or asks to "discuss in a file", when the task has several entangled decisions better thought through than chatted through, or when the user may want to step away and reply later. Do NOT use for single-question decisions, bug fixes, or when the user is actively present and driving. Requires the lazychat CLI to be installed.
---

# lazychat (CLI)

A file-based async discussion protocol. A shared markdown file acts like an email thread: you write questions or proposals, stop, and the user replies at their own pace in the same file.

Run `lazychat onboard` at the start of any session to see the protocol reference and active threads.

The key words MUST, MUST NOT, SHOULD, and MAY in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## How to operate it

1. **Confirm scope and context.** Before creating the file, you MUST have: the target artifact (what we want to ship), the core question or decision, and enough context to write round 1 without guessing. The prior chat counts as context; use what the human has already told you. If something needed is missing, ask in chat before creating the file.

2. **Create the thread** and capture the path:
   ```bash
   FILE=$(lazychat new my-topic --context - << 'EOF'
   We are deciding X so that Y. The core question is whether to A or B.
   Target artifact: the updated widget in src/widget.ts.
   EOF
   )
   ```

3. **Write your first turn:**
   ```bash
   lazychat reply "$FILE" --as agent --model claude-sonnet-4-6 --stdin << 'EOF'
   Your questions, proposals, or draft here. Freeform — number points,
   quote options, include diffs, whatever serves clarity.
   EOF
   ```

4. **Stop and tell the user in chat** that the file is ready at `$FILE`. You MUST NOT keep writing past the current round.

5. **Wait.** The user may reply in minutes, hours, or days. Do not nudge.

6. **Re-read the thread when resuming:**
   ```bash
   lazychat show "$FILE"             # full file on first read
   lazychat show "$FILE" --since N   # turns at round N onward (inclusive) for catch-up
   ```
   Do not skim. The file is the source of truth. If the next move is not clear after re-reading, ask in chat or write a short refresher round; do not guess.

7. **Continue** with further `lazychat reply` calls. When the discussion has converged, close the thread:
   ```bash
   lazychat converge "$FILE" --stdin << 'EOF'
   Decided: X. Rationale: Y. Next step: Z.
   EOF
   ```
   Then apply the outcome to the canonical artifact. The discussion file stays as the record.

## Other useful commands

```
lazychat list [--status open|converged|all] [--json]
lazychat status <file> [--json]
```

## Conventions

- **Attribution.** Agent turns MUST include `--model <your-model-id>` so the record shows which model wrote each turn.
- **Quote-and-reply.** When replying to specific lines, you SHOULD use `>` to quote the line or block, then write your reply below it.
- **Numbered questions.** When a turn has multiple questions, you SHOULD label them `**Q1.**` / `**Q2.**` so the human can quote and reply cleanly.
- **Long content.** You SHOULD wrap tool output, long code, or verbatim quotes in `<details><summary>...</summary>...</details>` to keep the reading flow clean.

## Rules

- **The file is the record.** You MUST NOT duplicate its content into chat. Chat is only for "file is ready" and "file is done" signals.
- **No reply vocabulary.** The user MAY reply with "ok", "yes", "LGTM", "nice", freeform prose, inline edits, or a new section. Accept any clear affirmation.
- **Do not edit canonical artifacts before the discussion concludes.** You MUST NOT modify the target artifact (code, docs, etc.) until the thread has converged.
- **One file per topic.** You MUST create a new file for each new topic. Do not reset or reuse across unrelated topics.

## When not to use

- Single-question decisions (chat is faster).
- Code review (use `git diff` or a review tool).
- Tasks where the user is actively present and driving.
- Tasks with no branching decisions.
