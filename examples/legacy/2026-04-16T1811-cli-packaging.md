---
title: Package lazychat as a CLI tool?
started: 2026-04-16
agent: claude-opus-4-7
human: fabio
rounds: 3
status: converged
---

# Package lazychat as a CLI tool?

<!--
Deciding whether lazychat ships as a protocol-only repo (skill + template + README)
or grows a CLI companion. Target artifact is whatever lands on main before the first
public push: possibly a `cli/` directory, possibly nothing, possibly a 10-line shell
script. This discussion doubles as the repo's first worked example.
-->

---

## Framing

The repo today is four files: `SKILL.md`, `README.md`, `templates/discussion.md`, `LICENSE`. No runtime. Any agent that can read and write files can run the protocol. Any human with a text editor can reply.

A CLI would add a fifth thing: a binary or script users install and agents shell out to. That changes the project's shape.

## What a CLI could do

1. `lazychat new <topic>` — create `.lazyai/YYYY-MM-DDTHHMM-<slug>.md` from the template, print the path.
2. `lazychat list` — show active discussions in the current tree.
3. `lazychat init` — drop `.lazyai/` + a local copy of the template into a repo.
4. `lazychat archive <file>` — move a concluded discussion to `.lazyai/archive/`.

None of these are things an agent cannot already do with its own file tools. The CLI would standardize *how* they get done.

## Arguments for a CLI

- **Convention enforcement.** If the agent shells out to `lazychat new`, file naming and template drift cannot happen. Today the SKILL says `YYYY-MM-DDTHHMM-<topic-slug>.md`; an agent could easily get the format wrong on a bad day.
- **Cross-agent parity.** pi.dev, Claude Code, Cursor, Aider, and a human shell all call the same command. One source of truth for the conventions.
- **Discoverability.** `brew install lazychat` or `npm i -g lazychat` is a real install story. A skill repo is harder to find and harder to explain to someone who is not already inside the Claude Code ecosystem.
- **Hooks.** A CLI gives a natural home for future features (search, archiving, cross-referencing) without bloating SKILL.md.

## Arguments against a CLI

- **Scope creep vs. the project's own thesis.** The README explicitly says "deliberately minimal, distilled from a day of real use. The longer spec was considered and cut because it was not load-bearing." A CLI is exactly the kind of thing that was cut.
- **Tooling-agnostic claim weakens.** Today the skill body works for any agent. A CLI introduces a runtime dependency: a language choice, a release process, a package manager, a version to pin.
- **The template is 14 lines.** An agent copying 14 lines from `templates/discussion.md` is not a reliability problem worth a binary.
- **Install friction kills adoption.** "Copy this skill into `~/.claude/skills/`" is a 5-second ask. "Install this CLI, then copy this skill, then configure the skill to call the CLI" is not.
- **Convention drift is a soft problem.** If an agent picks a slightly different filename, nothing breaks. The file is still the record.

## Middle ground

- **No CLI, ever.** Protocol-only. The repo's identity is "a markdown convention + a skill wrapper."
- **Ten-line shell script** (`bin/lazychat` or just a snippet in the README) that does `new` from the template. No install, no language runtime, just a `curl | bash` or a copy-paste.
- **Optional CLI in a sibling repo** (`lazychat-cli`) that depends on the protocol repo. Keeps the core clean, lets the CLI be a separate project with its own velocity.
- **Full CLI in this repo** under `cli/`, with `lazychat` as both the protocol and the tool.

## My read

I lean toward **no CLI at v0**, possibly with the shell-script compromise. Reasons:

1. The project's selling point in the README is the minimalism. A CLI contradicts it.
2. The problems a CLI would solve (filename drift, discoverability) are not real yet. You have one day of use. Build the CLI when the pain shows up, not prophylactically.
3. If the CLI does become warranted, a sibling repo keeps this one honest: the protocol stays independently useful for agents and humans who do not want to install anything.

## Questions for you

> 1. Who is your imagined adopter — another Claude Code user who will copy the skill, or a broader audience that expects `brew install`? That shapes whether discoverability is worth the scope expansion.

For the CLI? A terminal user that is comfortable with multiplexers like zellij can have a very rich workflow with no distractions from the chat history.

Example, the agent can run `lazychat wait-for-reply` which does something like this under the hood:

```bash
zellij run --stacked --name 'TOPIC NAME: Round 1' --block-until-exit --close-on-exit -- nvim README.md; echo $?; cat README.md
```

This to spins up nvim in a stacked pane and read the file again once the process exits.

That way it's a full round trip between a question asked and an answer received. We could even get fancy and commit to a separate repo and return the diff.

> 2. If we do a shell script, is it in the repo (`bin/lazychat`) or just a snippet in the README?

TBD

> 3. If we do *not* ship a CLI, should the README say so explicitly ("lazychat is a protocol, not a tool — by design") to preempt "where's the CLI?" questions?

Nothing is set on stone at this point

> 4. Is there a use case you have already hit where filename or template drift actually bit you? If yes, the CLI argument strengthens.

This is the very first discussion I'm having that got kicked off from the skill. I did have quite a few of these "email like" / "async discussions" in other projects already, mostly freeform and each one had it's own structure.

---

## Round 2 (agent)

### Reframe

Your answer to #1 changes the CLI discussion. I was imagining plumbing (`new`, `list`, `init`) that wraps file ops the agent already has. You are describing a **sync primitive**: `lazychat wait-for-reply` blocks the agent on a human editor session and returns when the user closes it. That is categorically different, and it unlocks something no file tool can do today.

Under the current skill, the round trip is: agent writes, agent tells user in chat, user sees notification later, user replies in file, user signals in chat, agent re-reads. That is five hops and requires the user to context-switch back into chat to signal. With `wait-for-reply`, the round trip is: agent writes, agent blocks, user opens pane, edits, closes pane, agent continues. One hop. No chat re-entry.

### But it complicates the name

"lazychat" promises **async** — email-thread semantics. `wait-for-reply` is sync — interactive editor session. These want to coexist, not replace each other:

- **Async mode (default)**: what the skill describes today. User replies whenever.
- **Sync mode (`wait-for-reply`)**: user is actively at the terminal, wants a fast round-trip, agent blocks.

Same file, same protocol, different dispatch. The agent picks based on signal ("I'll wait" vs "ping me when ready").

### Open questions

1. **What counts as "reply done"?** Editor exit is a proxy, but I save-and-quit mid-thought regularly. A sentinel line (`<!-- done -->`) is explicit but ceremonious. A second tool (`lazychat done`) the user runs adds friction. Which failure mode do you prefer — premature returns or extra typing?

2. **Environment detection.** Zellij is your setup; tmux, kitty, Ghostty, plain SSH, and VSCode integrated terminal all have different "open in pane" stories. Does the CLI:
   - (a) require zellij/tmux and bail otherwise,
   - (b) fall back to `$EDITOR` in the current terminal (blocking but no split), or
   - (c) respect a `LAZYCHAT_WAIT_COMMAND` env var so the user supplies their own spawn?

   (c) seems most future-proof and matches the "tooling-agnostic" claim.

3. **Git-diff-per-round.** You mentioned committing to a separate repo and returning the diff. What does that give you over just diffing the file in the parent repo? The separate-repo story feels like overkill for v0.1; inline diff from the file's pre-state to post-state is enough. Keep the separate-repo idea as a possible v0.2 if discussions pile up.

4. **Chat signaling becomes vestigial.** If the agent is mid-blocking-call, the "tell user in chat that the file is ready" step cannot happen — the tool call has not returned. Either `wait-for-reply` prints a startup line the user sees in the pane, or the agent sends the chat message via a separate mechanism (the `lmk` pattern you already use) before blocking. Probably the latter.

### Updated lean

- **v0 (now)**: ship protocol-only. What you have.
- **v0.1**: add `lazychat wait-for-reply` as a single-purpose CLI. Not `new`, not `list`, not `init` — those still fail the scope-creep test. Only the primitive that does something agents cannot.
- **Thought experiment**: `wait-for-reply` might not even belong in the lazychat repo. It is a general "block until human edits this file" tool. Could be its own micro-tool (`wait-for-edit`) that lazychat documents as a recommended companion. That keeps lazychat protocol-only forever and gives the sync primitive a life outside this project. Worth considering.

### Questions back to you

> 1. Sync + async coexistence, or does one absorb the other?

They both coexist, the fact the agent waits for a reply doesn't mean that the user will reply _right way_. This is about ergonomics: if I step away from the keyboard and come back, I know that if I `:x` on nvim the agent will see my reply right away, no need to tell it "go read my changes".

> 2. On "reply done" semantics — editor exit, sentinel line, or explicit `lazychat done`?

TBD

> 3. Separate micro-tool (`wait-for-edit`) or keep `wait-for-reply` inside lazychat?

TBD

---

## Round 3 (agent)

### On Q1

"Sync on the agent side, async on the human side" collapses the tension I raised. You can still walk away; `:x` just *is* the signal, replacing the chat re-entry. That also implicitly answers Q2: editor exit is the signal. No sentinel, no explicit `done` command. Cleaner than any of the options I floated.

One remaining risk with editor-exit-as-signal: I save-quit mid-thought often. If you do too, the agent will receive a premature "reply" and move on. Two responses:

- (a) Accept the cost for v0.1. If it bites, add an escape hatch (a sentinel line the tool checks for; if present, re-block).
- (b) Design the escape hatch up front.

I lean (a). Premature feedback from the user ("wait, I wasn't done") is a 5-second correction; over-designing the primitive is not.

### On Q3 (micro-tool vs in-repo)

Your Q1 answer reframes the primitive as "block until the human edits and closes this file." Nothing about that is lazychat-specific. It works for code review, spec drafts, handoff moments in any file-based human-in-the-loop flow. Three implications:

1. As a micro-tool (e.g. `wait-for-edit`), it has uses beyond this project. Standalone repo, general audience, pairs with lazychat but not bound to it.
2. Lazychat documents it as a recommended companion, the same way it documents skills for Claude Code vs. pi.dev.
3. Keeps lazychat the repo forever protocol-only. The CLI scope-creep question never comes back.

Downside: two repos to maintain. But `wait-for-edit` probably doesn't need much maintenance — it's a thin shell around `$EDITOR` + multiplexer spawn + a blocking wait. Maybe 50 lines of shell or Go.

### Proposed plan to converge

1. **Ship lazychat v0 today**: what we have now (SKILL, README with Related work, template, LICENSE). No CLI in this repo, ever.
2. **Separate repo for the sync primitive** (tentative name `wait-for-edit`), whenever you want to build it. Lazychat's README gets a one-line pointer once it exists.
3. **Leave this discussion file as the record** in `.lazyai/`. First worked example.

### Final questions

> 1. Agree with the plan: v0 ships today, sync primitive ships later in a separate repo?

v0 today -> yes, separate repo -> TBD

> 2. If yes to a separate repo, any name thoughts? `wait-for-edit`, `edit-wait`, `blockedit`, `handoff`, `holdopen`?

TBD, not sure I want fragmentation at this point. I already have another tool in the works that might rely on the protocol itself. I'll share the details when appropriate, not now.

> 3. Anything else on your mind before I stop editing this file and treat it as closed?

Just add your model name at the top, maybe use some frontmatter too? Do your best, this file is gonna get commited into source control as an example for others before I open source the project.

---

## Outcome

- **v0 ships protocol-only.** No CLI in the lazychat repo.
- **Sync primitive is parked.** A `wait-for-reply` / `wait-for-edit` style tool would unlock a tight round-trip (agent blocks on editor exit, no chat re-entry), but the human has another in-flight tool that may depend on the lazychat protocol. No new repo until that picture is clearer — avoid fragmentation.
- **This file becomes the first worked example**, moved out of `.lazyai/` (gitignored) into `examples/`.
- **Quirk to remember** for the future sync-primitive: `zellij run --stacked` targets the focused zellij tab, not necessarily the tab where the agent is running. Environment-detection / target-tab selection will need thought when that tool gets built.
