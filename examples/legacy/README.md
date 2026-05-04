# Legacy examples

These threads predate lazychat's canonical turn-header format
(`## Turn N (role)`) and never used it consistently:

- `2026-04-16T1811-cli-packaging.md` — first turn is bare prose under
  a section header, with no role attribution. `## Round 2 (agent)` and
  `## Round 3 (agent)` show up later. Pre-v0.0.4 parsers would have
  matched those `Round` headers, but the thread was never structurally
  clean.
- `2026-04-21T1034-templates-and-skill.md` — uses
  `## Round N — @model 🤖 · YYYY-MM-DD`, a non-canonical separator that
  never matched any version of the parser.

Kept on disk as historical record. Under the v0.0.4 strict parser,
which only accepts `## Turn N (role)`, the frontmatter and topic still
parse but no headers match, so both files report 0 turns. For a
current-format example see `../2026-04-23T1042-ts-port-open-questions.md`.
