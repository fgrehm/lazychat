# CHANGELOG

## Unreleased

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

## v0.0.1 — 2026-04-17

Initial release.
