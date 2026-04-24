# CHANGELOG

## v0.0.3 - Unreleased

### Added

- TypeScript + Bun rewrite of the entire project. The package is now published to npm as `lazychat` and installs a `lazychat` CLI binary.
- `lazychat new <slug> [--context -]` — creates a thread file at `.lazyai/YYYY-MM-DDTHHMM-<slug>.md` and prints the path.
- `lazychat reply <file> --as <agent|human> [--model <id>] [--stdin | --body <str> | --editor]` — appends a turn with proper round numbering and model attribution. `--editor` opens `$EDITOR` with the last turn pre-quoted; defaults to on for human turns with no body source. Empty or unchanged buffer aborts.
- `lazychat open <file>` — opens a thread file in `$EDITOR` for reading or manual editing.
- `lazychat skill` — prints the bundled `SKILL-CLI.md` content; embedded in the binary at build time so CLI installs no longer need a separate download step.
- `lazychat converge <file> [--stdin | --body <str>]` — appends an `## Outcome` section and flips `status` to `converged`.
- `lazychat list [--status open|converged|all] [--json]` — lists threads sorted by mtime, with optional JSON output.
- `lazychat show <file> [--round N | --last | --since N]` — prints thread content or a filtered subset of turns.
- `lazychat status <file> [--json]` — prints frontmatter, round count, and last-updated timestamp.
- `lazychat onboard` — prints the protocol reference and up to 10 active threads; intended as a session-start command for agents.
- Per-command help via `lazychat <command> --help` (powered by Commander).
- `SKILL-CLI.md` — companion skill for agents that have the CLI installed. Uses shell commands and heredocs instead of raw file edits; significantly shorter than `SKILL.md`.
- `examples/2026-04-23T1042-ts-port-open-questions.md` — converged thread from the TS port design session.

### Changed

- README now documents both install paths: CLI + `SKILL-CLI.md` for environments with the binary, and `SKILL.md` only for environments without.
- `bin` field points to `src/cli/index.ts` (Bun shebang) rather than a compiled binary, so the package works without a platform-specific build step.

## v0.0.2 - 2026-04-22

### Added

- `## Conventions` section in `SKILL.md` with MUST/SHOULD rules for turn headers, append-don't-insert ordering, quote-and-reply, numbered questions, `<details>` for long content, and HTML comment visibility.
- Scope-and-context confirmation as step 1 of `## How to operate it`: agents MUST confirm the target artifact, core question, and context (asking in chat if needed) before creating the file.
- Guidance on resuming threads: step 6 now covers picking up a thread cold; if the next move isn't clear after re-reading, the agent asks in chat or writes a refresher round rather than guessing.
- RFC 2119 keyword reference (MUST / MUST NOT / SHOULD / MAY) applied across Rules and Conventions.
- `status` field (`open` / `converged`) in the template frontmatter.
- `## Outcome` section and `status: converged` flip on thread convergence.
- Worked example of the v0.0.2 design process at `examples/2026-04-21T1034-templates-and-skill.md`.

### Changed

- Template now lives inline in `SKILL.md` as a fenced code block. One-file install.
- README install snippet simplified to a single `wget`; no `templates/` directory step.
- README Status section refreshed to reflect the v0.0.2 deletion-and-selective-return arc.

### Removed

- `templates/discussion.md` (contents inlined into `SKILL.md`).

## v0.0.1 - 2026-04-17

Initial release.
