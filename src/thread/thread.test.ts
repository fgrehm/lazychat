import { describe, expect, test } from "bun:test";
import * as fc from "fast-check";
import type { Turn } from "./index.ts";
import {
  nextRound,
  parseBytes,
  slugifyTopic,
  timestampedPath,
} from "./index.ts";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function t(round: number, role: "agent" | "human"): Turn {
  return { round, role, model: "", body: "", raw: "" };
}

function thread(body: string, fm = "status: open") {
  return `---\n${fm}\n---\n\n# test-topic\n\n${body}`;
}

function turnBlock(
  round: number,
  role: "agent" | "human",
  model?: string,
  body = "body",
) {
  const attr = model ? ` — @${model}` : "";
  return `## Round ${round} (${role})${attr}\n\n${body}`;
}

// ---------------------------------------------------------------------------
// slugifyTopic
// ---------------------------------------------------------------------------

describe("slugifyTopic", () => {
  test("lowercases ASCII", () => {
    expect(slugifyTopic("Hello World")).toBe("hello-world");
  });

  test("replaces spaces with hyphens", () => {
    expect(slugifyTopic("foo bar baz")).toBe("foo-bar-baz");
  });

  test("collapses runs of separators", () => {
    expect(slugifyTopic("foo   bar")).toBe("foo-bar");
    expect(slugifyTopic("foo---bar")).toBe("foo---bar"); // internal --- kept as-is
    expect(slugifyTopic("foo !!! bar")).toBe("foo-bar");
  });

  test("trims leading and trailing hyphens", () => {
    expect(slugifyTopic("  hello  ")).toBe("hello");
    expect(slugifyTopic("-hello-")).toBe("hello");
  });

  test("strips characters outside [a-z0-9_-]", () => {
    expect(slugifyTopic("hello@world!")).toBe("hello-world");
    expect(slugifyTopic("v0.0.1")).toBe("v0-0-1");
    expect(slugifyTopic("snake_case")).toBe("snake_case");
    expect(slugifyTopic("kebab-case")).toBe("kebab-case");
  });
});

// ---------------------------------------------------------------------------
// timestampedPath
// ---------------------------------------------------------------------------

describe("timestampedPath", () => {
  test("formats YYYY-MM-DDTHHMM from local time with no seconds", () => {
    const d = new Date(2026, 3, 23, 10, 42, 59); // Apr 23 2026 10:42:59 local
    const p = timestampedPath(".lazyai", "my-topic", d);
    expect(p).toContain("2026-04-23T1042");
    expect(p).not.toContain("59");
  });

  test("joins dir, timestamp and slug correctly", () => {
    const d = new Date(2026, 0, 5, 8, 3, 0); // Jan 05 2026 08:03
    const p = timestampedPath(".lazyai", "my-slug", d);
    expect(p).toBe(".lazyai/2026-01-05T0803-my-slug.md");
  });
});

// ---------------------------------------------------------------------------
// nextRound — 11-case truth table
// ---------------------------------------------------------------------------

describe("nextRound", () => {
  test("empty thread + agent -> 1", () => {
    expect(nextRound([], "agent")).toBe(1);
  });

  test("empty thread + human -> 1", () => {
    expect(nextRound([], "human")).toBe(1);
  });

  test("agent after agent round N -> N+1", () => {
    expect(nextRound([t(1, "agent")], "agent")).toBe(2);
  });

  test("human after agent round N -> N (no human at max)", () => {
    expect(nextRound([t(1, "agent")], "human")).toBe(1);
  });

  test("agent after human round N -> N+1", () => {
    expect(nextRound([t(1, "human")], "agent")).toBe(2);
  });

  test("human after human round N -> N+1", () => {
    expect(nextRound([t(1, "human")], "human")).toBe(2);
  });

  test("agent after complete round -> N+1", () => {
    expect(nextRound([t(1, "agent"), t(1, "human")], "agent")).toBe(2);
  });

  test("human after complete round -> N+1 (human exists at max)", () => {
    expect(nextRound([t(1, "agent"), t(1, "human")], "human")).toBe(2);
  });

  test("tolerates gaps (rounds 1 and 3 -> next agent = 4)", () => {
    expect(nextRound([t(1, "agent"), t(3, "agent")], "agent")).toBe(4);
  });

  test("tolerates duplicates (two round 1 entries -> uses max not len)", () => {
    expect(nextRound([t(1, "agent"), t(1, "agent")], "agent")).toBe(2);
  });

  test("human after agent-only round -> stays at max (no human at max)", () => {
    expect(nextRound([t(1, "agent"), t(2, "agent")], "human")).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// parseBytes
// ---------------------------------------------------------------------------

describe("parseBytes", () => {
  test("parses frontmatter status: open", () => {
    const th = parseBytes("f.md", thread(""));
    expect(th.status).toBe("open");
  });

  test("parses frontmatter status: converged", () => {
    const th = parseBytes("f.md", thread("", "status: converged"));
    expect(th.status).toBe("converged");
  });

  test("preserves extra frontmatter fields verbatim", () => {
    const fm = "status: open\ntitle: My Thread\nparticipants: fabio, agent";
    const th = parseBytes("f.md", thread("", fm));
    expect(th.frontmatterRaw).toContain("title: My Thread");
    expect(th.frontmatterRaw).toContain("participants: fabio, agent");
  });

  test("parses H1 as topic", () => {
    const th = parseBytes("f.md", thread(""));
    expect(th.topic).toBe("test-topic");
  });

  test("accepts CRLF line endings", () => {
    const raw = "---\r\nstatus: open\r\n---\r\n\r\n# crlf-topic\r\n";
    const th = parseBytes("f.md", raw);
    expect(th.status).toBe("open");
    expect(th.topic).toBe("crlf-topic");
  });

  test("tolerates annotations like (human, via chat) in turn headers", () => {
    const body = "---\n\n## Round 1 (human, via chat)\n\nbody\n";
    const th = parseBytes("f.md", thread(body));
    expect(th.turns).toHaveLength(1);
    expect(th.turns[0].role).toBe("human");
  });

  test("captures agent model attribution after the em-dash", () => {
    const body = `---\n\n${turnBlock(1, "agent", "claude-opus-4-7")}\n`;
    const th = parseBytes("f.md", thread(body));
    expect(th.turns[0].model).toBe("claude-opus-4-7");
  });

  test("human turns have empty model", () => {
    const body = `---\n\n${turnBlock(1, "human")}\n`;
    const th = parseBytes("f.md", thread(body));
    expect(th.turns[0].model).toBe("");
  });

  test("tolerates gaps and duplicate round numbers", () => {
    const body = [
      "---",
      "",
      turnBlock(1, "agent"),
      "",
      "---",
      "",
      turnBlock(3, "agent"),
      "",
      "---",
      "",
      turnBlock(1, "agent"),
    ].join("\n");
    const th = parseBytes("f.md", thread(body));
    expect(th.turns).toHaveLength(3);
    expect(th.turns.map((t) => t.round)).toEqual([1, 3, 1]);
  });

  test("detects ## Outcome section", () => {
    const body = "---\n\n## Outcome\n\ndone\n";
    const th = parseBytes("f.md", thread(body, "status: converged"));
    expect(th.hasOutcome).toBe(true);
  });

  test("hasOutcome is false when Outcome section absent", () => {
    const th = parseBytes("f.md", thread(""));
    expect(th.hasOutcome).toBe(false);
  });

  test("throws on missing frontmatter", () => {
    expect(() => parseBytes("f.md", "# no frontmatter\n")).toThrow();
  });

  test("throws on missing status", () => {
    expect(() =>
      parseBytes("f.md", "---\ntitle: no status\n---\n\n# topic\n"),
    ).toThrow();
  });

  test("property: never crashes on arbitrary input", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        try {
          parseBytes("f.md", s);
        } catch (e) {
          expect(e).toBeInstanceOf(Error);
        }
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// I/O functions — tested in step 2
// ---------------------------------------------------------------------------

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
  test.todo("errors when thread is converged (agent)", () => {});
  test.todo("errors when thread is converged (human)", () => {});
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
