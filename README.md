# lazychat

File-based async discussion protocol for pair programming with AI agents.

## What it is

A shared markdown file in your working tree where an AI agent writes questions or proposals, and you reply at your own pace. The file is the thread.

## Why

Chat is lossy for multi-decision work:

- **Context rot.** Replies re-quote what they are answering because the original scrolls away.
- **Sequential forcing.** Chat is LIFO. The human has to answer in chat order, not their own order.
- **No persistent artifact.** Chat transcripts are hard to revisit. A file can be re-opened, git-tracked, and referenced later.
- **Proposals get paraphrased on reply.** The agent cannot verify its own proposal landed intact.

Chat is also harder on people who can't keep its pace. Rapid-fire messaging expects real-time reading, fast typing, and uninterrupted attention; a markdown thread does not. You can walk away, read with a screen reader, take hours to compose a reply, and the agent waits without nagging.

Check out [this blog post](https://fabiorehm.com/blog/2026/04/17/lazychat/) for more background.

## How it works

1. Agent creates a file at `.lazyai/YYYY-MM-DDTHHMM-topic.md`.
2. Agent writes questions, proposals, or drafts in the file, then stops and tells you.
3. You reply in the file, freeform. No required structure.
4. Agent reads the file back in full and continues.

The protocol is tooling-agnostic. Any agent that reads and writes files, and any human with a text editor, can run it.

See [`examples/`](examples/) for completed threads from lazychat's own design sessions.

## Installation

There are two ways to use lazychat: with the CLI, or with just the skill file.

### With the CLI (recommended)

Download the binary for your platform from the [latest release](https://github.com/fgrehm/lazychat/releases/latest) and put it on your `PATH`:

```bash
# Linux x64 (adapt for darwin-arm64, etc.)
wget https://github.com/fgrehm/lazychat/releases/download/v0.0.3/lazychat-linux-x64 \
  -O ~/.local/bin/lazychat
chmod +x ~/.local/bin/lazychat
```

The binary is self-contained (the Bun runtime is bundled), no other dependencies.

Then install the CLI skill for your agent. The skill is bundled with the binary, so just dump it:

```bash
# Claude Code
mkdir -p .claude/skills/lazychat
lazychat skill > .claude/skills/lazychat/SKILL.md
```

The CLI-backed skill is shorter and simpler: the agent shells out instead of editing raw markdown, and `lazychat onboard` gives it the full protocol reference at session start.

### Skill only (no CLI required)

If you prefer not to install a binary, the file-based skill works without it. The agent reads and writes the thread files directly using the format described in `SKILL.md`.

```bash
# Claude Code
mkdir -p .claude/skills/lazychat
wget https://github.com/fgrehm/lazychat/raw/refs/tags/v0.0.3/SKILL.md \
  -O .claude/skills/lazychat/SKILL.md
```

## CLI reference

```
lazychat new <topic-slug> [--context -]
```
Create a new thread. Prints the file path. `--context -` reads one paragraph of context from stdin.

```
lazychat reply <file> --as <agent|human> [--model <id>] [--stdin | --body <str> | --editor]
```
Append a turn. `--as` is required. Exactly one body source (`--stdin`, `--body`, or `--editor`). `--model` is for agent turns. `--editor` is human-only and opens `$EDITOR` with the last turn pre-quoted; it is also the default when `--as human` is given with no body source. Empty or unchanged buffer aborts without appending.

```
lazychat open <file>
```
Open a thread file in `$EDITOR` for reading or manual editing.

```
lazychat converge <file> --stdin | --body <str>
```
Append an Outcome section and mark the thread converged. Exactly one of `--stdin` or `--body` must be given.

```
lazychat show <file> [--turn N | --last [N]]
```
Print thread content. No flag prints the whole file. `--turn N` prints the turn with id N. `--last [N]` prints the trailing N turns (default 1) — useful catch-up after the other side has written.

```
lazychat list [--status open|converged|all] [--json]
```
List threads in `.lazyai/`, most recent first. Defaults to open threads.

```
lazychat status <file> [--json]
```
Print frontmatter, turn count, and last-updated timestamp.

```
lazychat onboard
```
Print the protocol reference and active threads. Run this at the start of an agent session.

```
lazychat skill
```
Print the bundled `SKILL-CLI.md` to stdout. Useful for installing the skill into an agent's skills directory without a download step.

## Related work

lazychat sits next to a handful of projects that use shared markdown files as agent state, but differs in focus:

- [tick-md](https://purplehorizons.io/blog/tick-md-multi-agent-coordination-markdown): multi-agent coordination via a shared markdown task board. Agent-to-agent, with file locking, an MCP server, and a dashboard.
- [llm-md](https://llm.md/): a DSL for LLM-to-LLM conversations in markdown. Structured agent turns with explicit syntax.
- Basic Memory: bidirectional LLM-markdown knowledge persistence via MCP. Knowledge-graph shape, not discussion shape.

lazychat is narrower: human plus agent, freeform replies, explicit stop-and-wait, file-as-record.

## Status

Distilled from real use with pi coding agent and Claude Code. Deliberately minimal.

v0.0.3 added a TypeScript + Bun rewrite with a full CLI (`lazychat`) and a companion skill (`SKILL-CLI.md`) for agents that have it installed. The file-based `SKILL.md` remains for environments where the CLI is not available.

## License

MIT.
