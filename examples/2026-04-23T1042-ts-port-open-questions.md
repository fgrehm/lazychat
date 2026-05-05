---
status: converged
---

# ts-port-open-questions

<!--
Decision thread for the TypeScript + Bun port of `lazyturn` (a Go CLI, v0.0.1) into this `lazychat` repo. Binary becomes `lazychat`. Protocol and CLI live in the same repo from here on.

Motivation: easier integration with `pi-coding-agent` (library consumption instead of shelling out) and less fragmentation between the protocol repo and the CLI repo.

Working from a `HANDOFF.md` that was not committed to source control. Seven open questions about packaging, layout, testing, and scope. See the Outcome section at the end for the locked-in decisions. Implementation details that informed the discussion (file format invariants, library shape, gotchas) live in the code now.
-->

---

## Turn 1 (agent) - @claude-opus-4-7

Grouping the 7 open questions by how much input I need. Quote-and-reply in any order.

### Defaults I'd just apply unless you push back

**Q1. Bun version.** Latest stable at port time. Pin via `packageManager` in `package.json` + mirror in `.tool-versions` for mise/asdf. Matches the "latest toolchain, version-from-manifest" preference.

**Q2. Workspace layout.** Flat. `src/thread/` (library core) + `src/cli/` (CLI shell) + `src/index.ts` (library re-export). No Bun workspaces. HANDOFF leans this way; I agree. If pi-coding-agent ever wants core without CLI we can split later without API churn.

**Q6. Tests.** `bun test`. Zero config, fast, standard `describe`/`test`/`expect`. `fast-check` for the `parseBytes` fuzz equivalent. Integration tests compile the binary once in `beforeAll`, drive with `Bun.spawn` against `fs.mkdtempSync` dirs.

### Questions that need your input

**Q3. npm package shape.** Three options:

- **A. Single package `lazychat`** with two exports: the library (default) and a `bin`. Simplest publish, one version. pi-coding-agent does `import { appendTurn } from "lazychat"`.
- **B. Scoped split `@lazychat/core` + `@lazychat/cli`.** CLI depends on core. Two packages, versioned together. Cleaner boundary, more ceremony.
- **C. Single package, library-only exports; CLI is just a `bin`.** pi-coding-agent gets the lib; end users get the binary. No separate CLI export surface.

I lean **A** if pi-coding-agent imports TS directly, **C** if it shells out. **B** only if you foresee independent release cadences.

**Q4. pi-coding-agent integration shape.** I have no visibility into it. Please confirm:

- Is pi-coding-agent TS/Bun or something else?
- Library import (`from "lazychat"`), subprocess, or long-lived process (HTTP, MCP, stdio JSON-RPC)?
- Any operations beyond the current 7 commands? (file watching, multi-thread queries, push/event stream, stateful anything)
- If it's long-lived and does concurrent `reply` calls against the same file, we need per-file locking. Not needed if one-shot per invocation. Which?

**Q5. Command surface.** Same 7 commands with identical flag semantics, or additions pi-coding-agent wants from day one? I default to same-surface, preserve all 10 integration-test behaviors verbatim, new commands ride a later minor version.

**Q7. Fate of the Go `lazyturn` repo.** Archive on GitHub (read-only, visible as reference) vs keep live vs delete. I lean **archive**: preserves history and the two design threads in `.lazyai/`, signals unmaintained, costs nothing. Any reason to keep live?

### Sequencing (meta)

HANDOFF lists files to move in from `lazyturn`: `SPEC.md`, `ROADMAP.md`, `CLAUDE.md` (adapted), the two `.lazyai/` design threads, fold README "Usage" into this repo's README. Do that as a single "absorb lazyturn artifacts" commit before the port, or fold into the scaffolding commit? I'd do it first, separately, so the port diff is pure code.

---

## Turn 2 (human) - @fgrehm

Quick note: I plan to push this into `examples/` at the end

> ### Defaults I'd just apply unless you push back

Approved

> ### Questions that need your input
>
> **Q3. npm package shape.** Three options:
>
> - **A. Single package `lazychat`** with two exports: the library (default) and a `bin`. Simplest publish, one version. pi-coding-agent does `import { appendTurn } from "lazychat"`.
> - **B. Scoped split `@lazychat/core` + `@lazychat/cli`.** CLI depends on core. Two packages, versioned together. Cleaner boundary, more ceremony.
> - **C. Single package, library-only exports; CLI is just a `bin`.** pi-coding-agent gets the lib; end users get the binary. No separate CLI export surface.
>
> I lean **A** if pi-coding-agent imports TS directly, **C** if it shells out. **B** only if you foresee independent release cadences.

I want to KISS, I guess A is the best option at this point too

> **Q4. pi-coding-agent integration shape.** I have no visibility into it.

Lets keep this on the backburner. Just know that it works with TypeScript

> **Q5. Command surface.** Same 7 commands with identical flag semantics, or additions pi-coding-agent wants from day one? I default to same-surface, preserve all 10 integration-test behaviors verbatim, new commands ride a later minor version.

Same commands is a good start. We can revisit flags as we go.

> **Q7. Fate of the Go `lazyturn` repo.** Archive on GitHub (read-only, visible as reference) vs keep live vs delete. I lean **archive**: preserves history and the two design threads in `.lazyai/`, signals unmaintained, costs nothing. Any reason to keep live?

Yeah, I'll archive, repo never went public.

> ### Sequencing (meta)

Lets just start fresh here, using what you know about `lazyturn` without reverse engineering. I have some additional thoughts that I'll share as we go to help shape the tool as we rewrite it.

---

## Turn 3 (agent) - @claude-opus-4-7

Got it. Noted this file moves into `examples/` at the end.

### Locked-in decisions

- Latest stable Bun, pinned in `packageManager` + `.tool-versions`.
- Flat layout: `src/thread/` + `src/cli/` + `src/index.ts`.
- `bun test` + `fast-check` for fuzz.
- Single package `lazychat`, library default export + `bin`. KISS.
- Same 7 commands, same flag semantics as lazyturn v0.0.1. Revisit flags as we go.
- Archive the Go repo (never went public).
- pi-coding-agent: TS-compatible, details parked. Library stays pure (no stdout / no process.exit) so any integration shape fits later.
- Start fresh from what I know of lazyturn. No import of SPEC.md / ROADMAP.md / old `.lazyai/` design threads.

### Two tight clarifying questions before I scaffold

**Q8. "Start fresh" scope.** Confirming I should NOT bring over:

- `SPEC.md` (file-format authority — I'd instead write a short spec inline in `src/thread/` doc comments or a fresh `SPEC.md` if needed)
- `ROADMAP.md` (out-of-scope list lives in my head from HANDOFF)
- The two `lazyturn` design threads from `.lazyai/`
- The old `CLAUDE.md`

Is that right? Or do you want SPEC.md (or a trimmed version) as the canonical file-format reference in the new repo, since SKILL.md describes the protocol but not the format invariants?

**Q9. Scaffolding commit shape.** Proposing the first commit as a minimal skeleton:

- `package.json` (name `lazychat`, bin `lazychat` → `dist/lazychat`, `packageManager` pinned, scripts: `test`, `build`, `help`)
- `.tool-versions`, `tsconfig.json`, `.gitignore` (add `node_modules/`, keep `dist/`)
- `src/thread/index.ts` — type exports + function signatures, all throwing `not implemented`
- `src/thread/thread.test.ts` — empty shell with `describe` blocks matching the planned test structure
- `src/cli/index.ts` — argv dispatcher shell, each command throws not-implemented
- `src/cli/cli.test.ts` — empty shell
- `src/index.ts` — re-export library
- `Makefile` with `help`, `build`, `test`, `test-unit`, `test-integration`, `install`, `uninstall`, `clean`, `fmt`
- `.github/workflows/ci.yml` — Bun setup + `bun test`
- No `README.md` rewrite yet (preserve existing)
- No CHANGELOG bump yet

Green-light this shape, or want it smaller/larger? Anything you'd add?

Once you answer these I'll stop asking in this thread and start committing. Any "additional thoughts" can come as further rounds or as review of the scaffolding PR/commit.

---

## Turn 4 (human) - @fgrehm

> ### Two tight clarifying questions before I scaffold
>
> **Q8. "Start fresh" scope.**

Do not bring over anything

> **Q9. Scaffolding commit shape.** Proposing the first commit as a minimal skeleton:

All is good, but I wonder if a `Makefile` is something nodejs/bun projects do? That makes sense in go world, not sure about node

---

## Turn 5 (agent) - @claude-opus-4-7

Fair push. Makefiles exist in Node projects but are not idiomatic. The ecosystem default is `package.json` scripts, run via `bun run <script>`. `bun run` with no args already lists defined scripts, which covers the discoverability job that `make help` did in Go.

Three options:

- **A. `package.json` scripts only.** Idiomatic. `bun run` lists them. `install:local` script does the `ln -sf dist/lazychat ~/.local/bin/lazychat` dance. No Makefile.
- **B. `package.json` scripts + `justfile`** ([just](https://github.com/casey/just)). Cross-language task runner, `just` with no args lists recipes with doc comments (same ergonomic as `make help`). Adds one tool dependency for contributors.
- **C. Keep the Makefile.** Works, but sticks out in a Bun repo and duplicates what scripts already do.

I lean **A**. If you ever want the `make help`-style doc-comment discoverability on top, `bun run help` can just `cat package.json | jq '.scripts'` or similar, and `bun --help` lists built-ins.

Green-light A? Then Q8 + Q9 are settled and I'll write an `## Outcome` section, flip status to `converged`, and start scaffolding.

---

## Turn 6 (human) - @fgrehm

approved

---

## Outcome

Decisions locked in for the TypeScript + Bun port of lazyturn into this `lazychat` repo. Target artifact: the first scaffolding commit and everything that follows.

### Tooling and layout

- **Runtime**: latest stable Bun, pinned in `packageManager` (package.json) and mirrored in `.tool-versions`.
- **Layout**: flat. `src/thread/` (library core), `src/cli/` (CLI shell), `src/index.ts` (library re-export). No Bun workspaces.
- **Package**: single `lazychat` on npm. Library as default export, CLI via `bin` field. KISS.
- **Tests**: `bun test` built-in, `fast-check` for the `parseBytes` fuzz equivalent. Integration tests compile the binary once in `beforeAll` via `bun build --compile`, drive with `Bun.spawn` against `fs.mkdtempSync` dirs.
- **Task runner**: `package.json` scripts only. No Makefile, no justfile. `bun run` lists scripts for discoverability. `install:local` script handles the `~/.local/bin/lazychat` symlink.

### Scope

- **Commands**: same 7 as lazyturn v0.0.1 (`new`, `reply`, `converge`, `list`, `show`, `status`, `onboard`) with identical flag semantics. Revisit flags as the port progresses.
- **Library purity**: no stdout writes, no `process.exit`. CLI layer does I/O and exit codes. Keeps any pi-coding-agent integration shape open.
- **pi-coding-agent**: parked. Only constraint known is that it consumes TypeScript. Concrete integration shape (library import vs subprocess vs long-lived process, concurrency, extra operations) deferred to a later thread.
- **Start fresh**: do NOT import `SPEC.md`, `ROADMAP.md`, the old `CLAUDE.md`, or the two `lazyturn` design threads from `.lazyai/`. Work from the distilled knowledge in this thread's context block. Any spec or roadmap in the new repo gets written fresh when needed.
- **Go repo fate**: @fgrehm archives `lazyturn` on GitHub (was never public, no migration concerns).

### First scaffolding commit

Minimal skeleton, approved as listed:

- `package.json` (name `lazychat`, `bin` → `dist/lazychat`, `packageManager` pinned, scripts: `test`, `build`, `help`, `install:local`, `uninstall:local`, `clean`, `fmt`)
- `.tool-versions`, `tsconfig.json`, `.gitignore` (add `node_modules/`, keep `dist/`)
- `src/thread/index.ts` — type exports + function signatures, bodies throw `not implemented`
- `src/thread/thread.test.ts` — empty `describe` shells matching planned structure
- `src/cli/index.ts` — argv dispatcher shell, each command throws not-implemented
- `src/cli/cli.test.ts` — empty shell
- `src/index.ts` — re-export library
- `.github/workflows/ci.yml` — `oven-sh/setup-bun@v2` + `bun install --frozen-lockfile && bun test`
- No `README.md` rewrite yet, no CHANGELOG bump yet

### Meta

- This thread moves into `examples/` at the end of the port as a reference lazychat thread.
- Further thoughts from @fgrehm come as new rounds in new threads, or as review on commits.
- HANDOFF.md is not committed to source control; this thread (plus code + commits) is the durable record.
