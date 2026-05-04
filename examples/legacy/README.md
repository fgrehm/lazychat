# Legacy examples

These threads predate lazychat's canonical turn-header format
(`## Turn N (role)`) and never used it consistently:

- `2026-04-16T1811-cli-packaging.md` — first turn is bare prose under
  a section header, with no role attribution. `## Round 2 (agent)` and
  `## Round 3 (agent)` show up later but the thread isn't structurally
  parseable.
- `2026-04-21T1034-templates-and-skill.md` — uses
  `## Round N — @model 🤖 · YYYY-MM-DD`, a non-canonical separator that
  never matched the strict parser.

Kept on disk as historical record. They don't parse as threads under
any version of the lazychat parser, including the v0.0.4 strict regex.
For a current-format example see `../2026-04-23T1042-ts-port-open-questions.md`.
