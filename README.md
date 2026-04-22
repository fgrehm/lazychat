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

Chat is also harder on people who can't keep its pace. Rapid-fire messaging expects real-time reading, fast typing, and uninterrupted attention; a markdown thread does not. You can walk away, read with a screen reader, take hours to compose a reply, and the agent waits without nagging. That matters for your own focus, and it genuinely helps folks with cognitive, motor, visual, or energy-related disabilities who are not well-served by real-time tooling.

Check out [this blog post](https://fabiorehm.com/blog/2026/04/17/lazychat/) to know more about how this came to be.

## How it works

1. Agent creates a file at `.lazyai/YYYY-MM-DDTHHMM-topic.md` from the template embedded into the skill itself.
2. Agent writes questions, proposals, or drafts in the file, then stops and tells you.
3. You reply in the file, freeform. No required structure. No reply vocabulary.
4. Agent reads the file back in full and continues.

The protocol is tooling-agnostic. Any agent that reads and writes files, and any human with a text editor, can run it.

See [`examples/`](examples/) for completed threads from lazychat's own design sessions.

## Installation

`SKILL.md` content is agent-agnostic. The frontmatter follows Claude Code's convention and the body is just the protocol. You can adapt it to your needs and adjust the template as needed too.

```bash
# Pick your coding agent flavour
SKILL='.claude/skills/lazychat'
mkdir -p "${SKILL}"
wget https://github.com/fgrehm/lazychat/raw/refs/tags/v0.0.2/SKILL.md \
  -O "${SKILL}/SKILL.md"
```

## Related work

lazychat sits next to a handful of projects that use shared markdown files as agent state, but differs in focus:

- [tick-md](https://purplehorizons.io/blog/tick-md-multi-agent-coordination-markdown) — multi-agent coordination via a shared markdown task board. Agent-to-agent, with file locking, an MCP server, and a dashboard.
- [llm-md](https://llm.md/) — a DSL for LLM-to-LLM conversations in markdown. Structured agent turns with explicit syntax.
- Basic Memory — bidirectional LLM-markdown knowledge persistence via MCP. Knowledge-graph shape, not discussion shape.

lazychat is narrower: human plus agent, freeform replies, explicit stop-and-wait, file-as-record. Email thread between a person and an agent, not a shared state layer between agents.

## Status

Distilled from real use with pi coding agent and Claude Code. Deliberately minimal. Earlier drafts included reply vocabulary, round types, and a multi-state lifecycle. Those were cut.

v0.0.2 added back the pieces that kept earning their keep (numbered turn headers, `open` / `converged` status). More may land later, but only when the pain is concrete.

## License

MIT.
