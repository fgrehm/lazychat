import { describe, test } from "bun:test";

describe("slugifyTopic", () => {
  test.todo("lowercases ASCII", () => {});
  test.todo("replaces spaces with hyphens", () => {});
  test.todo("collapses runs of separators", () => {});
  test.todo("trims leading and trailing hyphens", () => {});
  test.todo("strips characters outside [a-z0-9_-]", () => {});
});

describe("timestampedPath", () => {
  test.todo(
    "formats YYYY-MM-DDTHHMM from local time with no seconds",
    () => {},
  );
  test.todo(
    "joins dir, timestamp and slug with the expected separator",
    () => {},
  );
});

describe("parseBytes", () => {
  test.todo("parses frontmatter status", () => {});
  test.todo("preserves extra frontmatter fields verbatim", () => {});
  test.todo("accepts CRLF line endings", () => {});
  test.todo(
    "tolerates annotations like (human, via chat) in turn headers",
    () => {},
  );
  test.todo("captures agent model attribution after the em-dash", () => {});
  test.todo("tolerates gaps and duplicate round numbers", () => {});
  test.todo("rejects missing status", () => {});
  test.todo("rejects malformed turn headers", () => {});
});

describe("nextRound", () => {
  test.todo("empty thread agent -> 1", () => {});
  test.todo("empty thread human -> 1", () => {});
  test.todo("agent after agent round N -> N+1", () => {});
  test.todo("human after agent round N -> N", () => {});
  test.todo("human after human round N -> N+1", () => {});
  test.todo("agent after human round N -> N+1", () => {});
  test.todo("tolerates gaps (rounds 1 and 3 -> next agent = 4)", () => {});
  test.todo(
    "tolerates duplicates (two round 1 entries -> max N not len)",
    () => {},
  );
  test.todo("agent after converged -> errors", () => {});
  test.todo("human after converged -> errors", () => {});
  test.todo("fuzz: parseBytes never throws on arbitrary input", () => {});
});

describe("newThread", () => {
  test.todo("creates file at the given path with status: open", () => {});
  test.todo(
    "writes topic as H1 and embeds context in the HTML comment",
    () => {},
  );
  test.todo("errors when file already exists", () => {});
  test.todo("atomic write (temp file + rename)", () => {});
});

describe("appendTurn", () => {
  test.todo("appends agent turn with model attribution", () => {});
  test.todo("appends human turn without model attribution", () => {});
  test.todo("ignores model for human turns", () => {});
  test.todo("numbers the round per nextRound rules", () => {});
  test.todo("errors on converged thread", () => {});
  test.todo("preserves extra frontmatter fields on write", () => {});
});

describe("converge", () => {
  test.todo("appends Outcome section", () => {});
  test.todo(
    "flips status: open -> converged via in-place regex rewrite",
    () => {},
  );
  test.todo("does not rewrite prior turn bodies", () => {});
  test.todo("errors when already converged", () => {});
});

describe("listThreads", () => {
  test.todo("filters by open / converged / all", () => {});
  test.todo("sorts by mtime descending", () => {});
  test.todo("skips malformed files silently", () => {});
  test.todo("returns empty list when .lazyai does not exist", () => {});
});
