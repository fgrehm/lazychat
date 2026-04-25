# Repository instructions for Copilot

lazychat is a file-based async discussion protocol: a shared markdown file in the working tree acts like an email thread between a human and an AI agent. See `README.md` and `SKILL.md` for the protocol itself.

## Runtime and distribution

- This is a **Bun** project, not a Node.js project. TypeScript sources are the entry points (`src/cli/index.ts`, `src/index.ts`) and run directly via the `#!/usr/bin/env bun` shebang. `engines.bun` in `package.json` declares the runtime requirement.
- Distribution is via **compiled binaries** published to GitHub Releases (`bun build --compile`), not npm. **No npm publish is planned in v0.0.x.** Do not suggest publishing `.js` artifacts, building a JS shim, or changing `main`/`exports`/`bin` away from `.ts` paths. The `.ts` entries are intentional and will stay until npm publishing is explicitly back on the table.
- Assets bundled into the binary (e.g. `SKILL-CLI.md`) are embedded with Bun text imports: `import X from "./file.md" with { type: "text" }`.

## Protocol invariants

- Threads are **append-only**. Never edit or reorder prior turns.
- The protocol is **stop-and-wait**: the agent writes, stops, and waits for the human. Concurrent writers are out of scope; locking or optimistic-concurrency schemes are not required unless the scope explicitly changes.
- Turn headers are written as `## Round N (role) - @model-id` with a plain hyphen. The parser also accepts U+2013 (en-dash) and U+2014 (em-dash) so older threads and hand-typed turns parse cleanly. This forgiveness is intentional.
- A thread with `status: converged` is read-only.

## Code conventions

- Prefer editing existing files to adding new ones. Do not introduce scaffolding, feature flags, or backwards-compat shims for hypothetical future requirements.
- Default to no comments. Add a comment only when the *why* is non-obvious (hidden constraint, subtle invariant, documented workaround). Do not restate what well-named code already conveys.
- Use ASCII quotes (`"` and `'`) in code and strings, not Unicode typographic quotes. Formatters restore Unicode on commit and cause staged diffs to flip back.
- In prose (comments, docs, commit messages), use commas, periods, or parentheses for mid-sentence breaks. Not em-dashes or double-dashes.
- File writes must be atomic: use the `atomicWrite` helper (temp file in the same directory + `rename`) for updates, or `writeFile({ flag: "wx" })` for exclusive create. Do not propose plain overwriting writes.
- Skip marketing fluff in docs and reviews ("comprehensive", "robust", "seamless", "cutting-edge"). Be direct.
- When a `let` is assigned across `if`/`else` branches, give it an explicit type annotation. TypeScript narrows it correctly under `strict`, but reviewers may flag the bare declaration as implicit `any`.

## Docs and conventions

- A `MUST` in `SKILL.md` or `SKILL-CLI.md` must be enforced by the CLI. If the CLI accepts a fallback (e.g. `@unknown` for missing `--model`), use `SHOULD` and mention the fallback so docs match observable behavior.
- When changing a written convention (turn-header separator, status values, file naming), audit `examples/` and `.lazyai/` for stragglers in the same commit. Tracked example threads are part of the contract; drift is misleading.

## Testing

- Unit tests live next to the module under test (`src/thread/thread.test.ts`). Integration tests (`src/cli/cli.test.ts`) compile the binary once in `beforeAll` via `bun build --compile` and drive it with `Bun.spawn`.
- Match the existing test style: `describe` per command or area, each test creates its own temp directory via `tempDir()` and cleans up in `finally`.

## Commits and pull requests

- Conventional commits, present tense, title under 72 characters. Scopes (`feat(cli):`, `fix(thread):`) are welcome when they clarify the surface area.
- Create a new commit rather than amending. Never skip hooks.
- `.husky/*` hooks intentionally have no shebang or `husky.sh` sourcing. Husky v9 (used here) [removed that boilerplate](https://typicode.github.io/husky/migrate-from-v8.html); v8-style additions would be wrong for the current version.
