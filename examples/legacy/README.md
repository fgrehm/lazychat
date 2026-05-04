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

Kept on disk as historical record. The frontmatter and topic still
parse, but their non-canonical headers don't match the turn regex
(any version, including v0.0.4 strict), so they report 0 turns. For
a current-format example see `../2026-04-23T1042-ts-port-open-questions.md`.
