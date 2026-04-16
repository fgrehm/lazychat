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

## How it works

1. Agent creates a file at `.lazyai/YYYY-MM-DDTHHMM-topic.md` from the template in `templates/discussion.md`.
2. Agent writes questions, proposals, or drafts in the file, then stops and tells you.
3. You reply in the file, freeform. No required structure. No reply vocabulary.
4. Agent reads the file back in full and continues.

The protocol is tooling-agnostic. Any agent that reads and writes files, and any human with a text editor, can run it.

## Use with Claude Code

Copy or symlink this repo into `~/.claude/skills/lazychat/`. The `SKILL.md` declares when Claude Code should load it.

## Use with other agents

`SKILL.md` content is agent-agnostic. The frontmatter follows Claude Code's convention; the body is just the protocol. Adapt the wrapper for pi.dev or whatever agent you use.

## Status

v0, distilled from a day of real use with pi.dev and Claude Code. Deliberately minimal. The longer spec with rounds, reply vocabulary, round types, and lifecycle rules was considered and cut because it was not load-bearing in practice.

## License

MIT.
