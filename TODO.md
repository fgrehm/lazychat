# TODO

## v0.0.3 release

1. **Bump version.** `package.json`: `0.0.3-dev` → `0.0.3`, `CHANGELOG.md`: drop "Unreleased", add date.
2. **Tag + push.** `git tag v0.0.3 && git push --tags` triggers the release workflow. Verify the four binaries land and the skill install snippet in README resolves against the tag.
3. **Archive the Go `lazyturn` repo** on GitHub (user-side action).

## v0.0.4 candidates

Nothing committed to; collect and filter when v0.0.3 is out.

- **Turn length.** Both Kimi-k2.6 and Opus 4.7 produced very long opening turns in testing. Open question: add a SKILL.md convention ("stay focused, one move per round") or does the convention get ignored? Needs more model observations.
- **`converge --editor`.** Symmetry with `reply --editor`. Trivial if we want it.
- **Slug-based file resolution.** `lazychat reply my-slug --as human` instead of the full `.lazyai/YYYY-MM-DDTHHMM-slug.md` path. Match newest file whose slug portion equals the arg. Quality-of-life.
- **Malformed-header warning.** Parser tolerates hyphen/en-dash/em-dash silently; consider a `--strict` flag or a `lazychat lint` that flags non-canonical headers before they cause surprises.
  - Also: H1 topic search uses `text.match(/^# (.+)$/m)` against the whole file, so a turn body containing `# something` could be picked up as the topic when the real heading is missing (PR #2 review). Scope the search to the slice between frontmatter end and the first turn header. Edge-case (requires both defects at once); fold into the lint pass.
- **Proper draft mode.** Deferred from v0.0.3. `--editor` currently commits on save; a real draft would save to `.lazyai/.drafts/` and require an explicit finalize step. Only worth it if dogfooding shows people want to compose-and-walk-away mid-reply.
  - Related: re-running `reply --as human` does not resume a previous draft. Each invocation rebuilds the editor template from `thread.turns.at(-1).body` in a fresh `mktemp` dir that's wiped on exit (src/cli/index.ts:91-122). So aborting (empty/unchanged save) loses the buffer, and a second human reply quotes the just-appended human turn instead of re-opening it. Two possible shapes: (a) detect "last turn is mine" and offer to amend, or (b) persist the tmp file at a stable path like `.lazyai/.drafts/<thread>.md` so re-running picks it up.
- **Multi-package npm optional-deps.** Deferred from v0.0.3. Bundle per-platform binaries as optional-deps under one `lazychat` package on npm. Only needed if people ask for `npm install -g lazychat`.
- **Agent attribution: enforce or accept fallback.** `reply --as agent` currently allows omitting `--model` and writes `@unknown`. SKILL-CLI used to claim `MUST` and was relaxed to `SHOULD` to match behavior (PR #2 review). Pick a side: require `--model` for agent turns (tighter contract, breaking) or keep the fallback and document it (current state). Lean on dogfooding: if `@unknown` shows up in real threads, enforce.
- **Multi-round quoting in `reply --editor`.** Today the editor template quotes only `lastTurn.body`. Dogfooding: sometimes context from earlier rounds matters and a single-round quote isn't enough. Options: `--quote N` to control depth, no quoting by default with the user opening the thread in another buffer, or auto-include the most recent agent + human pair. Design before code.
- **Per-thread write lock.** Flagged by Copilot on PR #2: `appendTurn`/`converge` are atomic at the file level (temp + rename) but two processes can read the same snapshot, compute the same `nextRound`, and the second rename wins, silently dropping an update. Protocol is stop-and-wait so this is unlikely in practice, but a lockfile (`<path>.lock` via `writeFile({flag: "wx"})` with retry) or optimistic concurrency (mtime check before rename) would close the hole. Decide based on whether any concurrent-writer scenarios actually surface in dogfooding.

## Dogfood observations

Write notes here as they surface. Each one is either a bug (fix in-branch) or a v0.0.4 candidate (move to the list above).

- `zellij run --close-on-exit --stacked --name lazyreply -- lazychat reply .lazyai/... --as human`
- Sometimes we need context from prior rounds, quoting just the previous round is not always useful...
- We should instruct models to not append `---` on their replies, makes it harder to scan the file
