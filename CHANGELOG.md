# CHANGELOG

## Unreleased

### Changed

- `examples/2026-04-23T1042-ts-port-open-questions.md`: turn headers migrated from `## Round N (role)` to `## Turn N (role)`, ids renumbered monotonically (1–6) so the file parses under the v0.0.4 strict regex. Body text untouched.
- `examples/2026-04-16T1811-cli-packaging.md` and `examples/2026-04-21T1034-templates-and-skill.md`: moved to `examples/legacy/` with a README. They predate the canonical turn-header format and don't parse under any version of the parser.

### Added

- **Pretty markdown rendering on `show` when stdout is a TTY.** `lazychat show` now detects `process.stdout.isTTY` and renders through [marked-terminal](https://github.com/mikaelbr/marked-terminal) for human readers (colors, code highlighting). On a pipe or redirect the output stays raw markdown so agents and tooling get a deterministic, parseable stream. No new flag, no new verb. Source: `~/projects/oss/lazyai/.lazyai/2026-04-30T2122-chat-view-renderer.md`.

### Changed

- **Turn ids replace round numbers.** Headers are now `## Turn N (role)` with N monotonic across the whole thread (not paired by role). Two `(agent)` turns in a row are legal. Asymmetric threads no longer require a placeholder turn to advance. CLI `status`/`list` report `turns` instead of `rounds` (in both text and JSON output).
- `lazychat show --since N` is gone. `--last [N]` (default 1) is the new catch-up flag and accepts an optional count, so `--last 3` prints the trailing three turns. `--round N` was renamed to `--turn N`.
- `lazychat reply` success message is now role-aware: prints the appended turn id and a one-line `lazychat show <file> --last 1` hint targeted at the other side.
- `lazychat new` prints a "Thread is ready" hint to stderr alongside the path on stdout, suggesting the next `lazychat reply` invocation.
- Parser is strict: only `## Turn N (role)` headers are recognised. Existing files with `## Round N (role)` headers still parse (frontmatter and topic are read normally), but the legacy headers no longer match the turn regex, so `status` and `list` report `turns: 0` and `--turn N`/`--last N` see an empty thread. No migration is provided.

## v0.0.3 - 2026-04-26

### Added

- TypeScript + Bun rewrite of the entire project. Distribution is cross-compiled, self-contained `lazychat` binaries (Linux/Darwin × x64/arm64) published to GitHub Releases; an npm package is intentionally not published in this release.
- `lazychat new <slug> [--context -]`: creates a thread file at `.lazyai/YYYY-MM-DDTHHMM-<slug>.md` and prints the path.
- `lazychat reply <file> --as <agent|human> [--model <id>] [--stdin | --body <str> | --editor]`: appends a turn with proper round numbering and model attribution. `--editor` opens `$EDITOR` with the last turn pre-quoted; defaults to on for human turns with no body source. Empty or unchanged buffer aborts.
- `lazychat open <file>`: opens a thread file in `$EDITOR` for reading or manual editing.
- `lazychat skill`: prints the bundled `SKILL-CLI.md` content; embedded in the binary at build time so CLI installs no longer need a separate download step.
- `lazychat converge <file> (--stdin | --body <str>)`: appends an `## Outcome` section and flips `status` to `converged`.
- `lazychat list [--status open|converged|all] [--json]`: lists threads sorted by mtime, with optional JSON output.
- `lazychat show <file> [--round N | --last | --since N]`: prints thread content or a filtered subset of turns.
- `lazychat status <file> [--json]`: prints frontmatter, round count, and last-updated timestamp.
- `lazychat onboard`: prints the protocol reference and up to 10 active threads; intended as a session-start command for agents.
- Per-command help via `lazychat <command> --help` (powered by Commander).
- `SKILL-CLI.md`: companion skill for agents that have the CLI installed. Uses shell commands and heredocs instead of raw file edits; significantly shorter than `SKILL.md`.
- `examples/2026-04-23T1042-ts-port-open-questions.md`: converged thread from the TS port design session.

### Changed

- README now documents both install paths: CLI + `SKILL-CLI.md` for environments with the binary, and `SKILL.md` only for environments without.
- `bin` field points to `src/cli/index.ts` (Bun shebang) rather than a compiled binary, so the package works without a platform-specific build step.
- `SKILL.md` and `SKILL-CLI.md`: agents SHOULD NOT write `---` separators inside turn bodies; the separator is inserted between turns. Agent attribution relaxed from MUST to SHOULD with a note that omitted models record as `@unknown`, matching CLI behavior.

## v0.0.2 - 2026-04-22

### Added

- `## Conventions` section in `SKILL.md` with MUST/SHOULD rules for turn headers, append-don't-insert ordering, quote-and-reply, numbered questions, `<details>` for long content, and HTML comment visibility.
- Scope-and-context confirmation as step 1 of `## How to operate it`: agents MUST confirm the target artifact, core question, and context (asking in chat if needed) before creating the file.
- Guidance on resuming threads: step 6 now covers picking up a thread cold; if the next move isn't clear after re-reading, the agent asks in chat or writes a refresher round rather than guessing.
- RFC 2119 keyword reference (MUST / MUST NOT / SHOULD / MAY) applied across Rules and Conventions.
- `status` field (`open` / `converged`) in the template frontmatter.
- `## Outcome` section and `status: converged` flip on thread convergence.
- Worked example of the v0.0.2 design process at `examples/legacy/2026-04-21T1034-templates-and-skill.md` (moved to `legacy/` in v0.0.4 because its non-canonical headers stop parsing under the strict turn-id regex).

### Changed

- Template now lives inline in `SKILL.md` as a fenced code block. One-file install.
- README install snippet simplified to a single `wget`; no `templates/` directory step.
- README Status section refreshed to reflect the v0.0.2 deletion-and-selective-return arc.

### Removed

- `templates/discussion.md` (contents inlined into `SKILL.md`).

## v0.0.1 - 2026-04-17

Initial release.
