import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import * as fc from "fast-check";
import { mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Turn } from "./index.ts";
import {
  appendTurn,
  converge,
  listThreads,
  maxRound,
  newThread,
  nextRound,
  parse,
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

function threadFile(body: string, fm = "status: open") {
  return `---\n${fm}\n---\n\n# test-topic\n\n${body}`;
}

function turnBlock(
  round: number,
  role: "agent" | "human",
  model?: string,
  body = "body",
) {
  const attr = model ? ` - @${model}` : "";
  return `## Round ${round} (${role})${attr}\n\n${body}`;
}

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "lazychat-test-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

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
  test("formats YYYY-MM-DDTHHMM from UTC with no seconds", () => {
    const d = new Date(Date.UTC(2026, 3, 23, 10, 42, 59)); // Apr 23 2026 10:42:59 UTC
    const p = timestampedPath(".lazyai", "my-topic", d);
    expect(p).toContain("2026-04-23T1042");
    expect(p).not.toContain("59");
  });

  test("joins dir, timestamp and slug correctly", () => {
    const d = new Date(Date.UTC(2026, 0, 5, 8, 3, 0)); // Jan 05 2026 08:03 UTC
    const p = timestampedPath(".lazyai", "my-slug", d);
    expect(p).toBe(".lazyai/2026-01-05T0803-my-slug.md");
  });
});

// ---------------------------------------------------------------------------
// nextRound: 11-case truth table
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
// maxRound
// ---------------------------------------------------------------------------

describe("maxRound", () => {
  test("empty thread -> 0", () => {
    expect(maxRound([])).toBe(0);
  });

  test("returns the largest round across gaps and duplicates", () => {
    expect(
      maxRound([t(1, "agent"), t(3, "agent"), t(2, "human"), t(3, "human")]),
    ).toBe(3);
  });

  test("handles arrays larger than the spread-arg limit", () => {
    // Math.max(...arr) throws RangeError around 100k–500k args depending on
    // engine; the loop implementation has no such cliff.
    const big: Turn[] = Array.from({ length: 200_000 }, (_, i) =>
      t(i + 1, "agent"),
    );
    expect(maxRound(big)).toBe(200_000);
  });
});

// ---------------------------------------------------------------------------
// parseBytes
// ---------------------------------------------------------------------------

describe("parseBytes", () => {
  test("parses frontmatter status: open", () => {
    const th = parseBytes("f.md", threadFile(""));
    expect(th.status).toBe("open");
  });

  test("parses frontmatter status: converged", () => {
    const th = parseBytes("f.md", threadFile("", "status: converged"));
    expect(th.status).toBe("converged");
  });

  test("preserves extra frontmatter fields verbatim", () => {
    const fm = "status: open\ntitle: My Thread\nparticipants: fabio, agent";
    const th = parseBytes("f.md", threadFile("", fm));
    expect(th.frontmatterRaw).toContain("title: My Thread");
    expect(th.frontmatterRaw).toContain("participants: fabio, agent");
  });

  test("parses H1 as topic", () => {
    const th = parseBytes("f.md", threadFile(""));
    expect(th.topic).toBe("test-topic");
  });

  test("throws when H1 topic heading is missing", () => {
    const raw = "---\nstatus: open\n---\n\nno heading here\n";
    expect(() => parseBytes("f.md", raw)).toThrow(/missing topic heading/);
  });

  test("does not pick up H1 inside a turn body as the topic", () => {
    const raw =
      "---\nstatus: open\n---\n\n---\n\n## Round 1 (human)\n\n# not the topic\n\nbody\n";
    expect(() => parseBytes("f.md", raw)).toThrow(/missing topic heading/);
  });

  test("throws when H1 topic heading is empty", () => {
    const raw = "---\nstatus: open\n---\n\n#   \n";
    expect(() => parseBytes("f.md", raw)).toThrow(/must not be empty/);
  });

  test("accepts CRLF line endings", () => {
    const raw = "---\r\nstatus: open\r\n---\r\n\r\n# crlf-topic\r\n";
    const th = parseBytes("f.md", raw);
    expect(th.status).toBe("open");
    expect(th.topic).toBe("crlf-topic");
  });

  test("tolerates annotations like (human, via chat) in turn headers", () => {
    const body = "---\n\n## Round 1 (human, via chat)\n\nbody\n";
    const th = parseBytes("f.md", threadFile(body));
    expect(th.turns).toHaveLength(1);
    expect(th.turns[0].role).toBe("human");
  });

  test("captures agent model attribution after the separator", () => {
    const body = `---\n\n${turnBlock(1, "agent", "claude-opus-4-7")}\n`;
    const th = parseBytes("f.md", threadFile(body));
    expect(th.turns[0].model).toBe("claude-opus-4-7");
  });

  test("accepts hyphen or en-dash attribution (hand-typed turns)", () => {
    const body = [
      "---",
      "",
      "## Round 1 (human) - @fgrehm",
      "",
      "hyphen body",
      "",
      "---",
      "",
      "## Round 2 (human) – @fgrehm",
      "",
      "en-dash body",
    ].join("\n");
    const th = parseBytes("f.md", threadFile(body));
    expect(th.turns).toHaveLength(2);
    expect(th.turns[0].model).toBe("fgrehm");
    expect(th.turns[1].model).toBe("fgrehm");
  });

  test("preserves a markdown horizontal rule inside a turn body", () => {
    // A `---` line that is NOT followed by a turn header / Outcome is a
    // legitimate markdown horizontal rule and must stay in the body.
    const body = [
      "---",
      "",
      "## Round 1 (human)",
      "",
      "intro paragraph",
      "",
      "---",
      "",
      "section after a horizontal rule",
      "",
      "---",
      "",
      "## Round 2 (agent) - @claude",
      "",
      "reply",
    ].join("\n");
    const th = parseBytes("f.md", threadFile(body));
    expect(th.turns).toHaveLength(2);
    expect(th.turns[0].body).toContain("intro paragraph");
    expect(th.turns[0].body).toContain("---");
    expect(th.turns[0].body).toContain("section after a horizontal rule");
    expect(th.turns[1].body).toBe("reply");
  });

  test("preserves a horizontal rule before the Outcome separator", () => {
    const body = [
      "---",
      "",
      "## Round 1 (human)",
      "",
      "body with rule",
      "",
      "---",
      "",
      "trailing text after rule",
      "",
      "---",
      "",
      "## Outcome",
      "",
      "decided",
    ].join("\n");
    const th = parseBytes("f.md", threadFile(body, "status: converged"));
    expect(th.turns).toHaveLength(1);
    expect(th.turns[0].body).toContain("body with rule");
    expect(th.turns[0].body).toContain("trailing text after rule");
    expect(th.hasOutcome).toBe(true);
  });

  test("human turns have empty model", () => {
    const body = `---\n\n${turnBlock(1, "human")}\n`;
    const th = parseBytes("f.md", threadFile(body));
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
    const th = parseBytes("f.md", threadFile(body));
    expect(th.turns).toHaveLength(3);
    expect(th.turns.map((t) => t.round)).toEqual([1, 3, 1]);
  });

  test("detects ## Outcome section", () => {
    const body = "---\n\n## Outcome\n\ndone\n";
    const th = parseBytes("f.md", threadFile(body, "status: converged"));
    expect(th.hasOutcome).toBe(true);
  });

  test("hasOutcome is false when Outcome section absent", () => {
    const th = parseBytes("f.md", threadFile(""));
    expect(th.hasOutcome).toBe(false);
  });

  test("hasOutcome is false when '## Outcome' appears only inside a turn body", () => {
    // Agent quotes the literal heading while discussing the protocol. There
    // is no real Outcome section: status stays open.
    const body = [
      "---",
      "",
      "## Round 1 (agent) - @claude",
      "",
      "When converged, lazychat appends a section like:",
      "",
      "## Outcome",
      "",
      "decided: X",
    ].join("\n");
    const th = parseBytes("f.md", threadFile(body));
    expect(th.hasOutcome).toBe(false);
  });

  test("hasOutcome accepts Outcome heading with extra whitespace", () => {
    const body = "---\n\n##  Outcome  \n\ndone\n";
    const th = parseBytes("f.md", threadFile(body, "status: converged"));
    expect(th.hasOutcome).toBe(true);
  });

  test("isTurnSeparator before Outcome tolerates extra whitespace", () => {
    // Turn body must end at the `---` preceding `##  Outcome  ` (extra
    // spaces); the Outcome heading must not be swallowed into the body.
    const body = [
      "---",
      "",
      "## Round 1 (human)",
      "",
      "body text",
      "",
      "---",
      "",
      "##  Outcome  ",
      "",
      "decided",
    ].join("\n");
    const th = parseBytes("f.md", threadFile(body, "status: converged"));
    expect(th.turns).toHaveLength(1);
    expect(th.turns[0].body).toBe("body text");
    expect(th.hasOutcome).toBe(true);
  });

  test("preserves leading whitespace on the first body line", () => {
    const body = [
      "---",
      "",
      "## Round 1 (agent)",
      "",
      "    indented code",
      "    more code",
    ].join("\n");
    const th = parseBytes("f.md", threadFile(body));
    expect(th.turns).toHaveLength(1);
    expect(th.turns[0].body).toBe("    indented code\n    more code");
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
// newThread
// ---------------------------------------------------------------------------

describe("newThread", () => {
  test("creates file with status: open and H1 topic", async () => {
    const path = join(dir, "thread.md");
    await newThread(path, "my-topic", "some context");
    const th = await parse(path);
    expect(th.status).toBe("open");
    expect(th.topic).toBe("my-topic");
  });

  test("embeds single-line context inline in the HTML comment", async () => {
    const path = join(dir, "thread.md");
    await newThread(path, "my-topic", "what we are figuring out");
    const data = await Bun.file(path).text();
    expect(data).toContain("<!-- what we are figuring out -->");
  });

  test("formats multiline context with delimiters on their own lines", async () => {
    const path = join(dir, "thread.md");
    const ctx = "Paragraph one.\nParagraph two.\n\nParagraph three.";
    await newThread(path, "my-topic", ctx);
    const data = await Bun.file(path).text();
    expect(data).toContain(`<!--\n${ctx}\n-->`);
    expect(data).not.toContain(`<!-- ${ctx}`);
  });

  test("auto-creates parent directory", async () => {
    const path = join(dir, "nested", ".lazyai", "thread.md");
    await newThread(path, "slug", "ctx");
    const th = await parse(path);
    expect(th.status).toBe("open");
  });

  test("errors when file already exists", async () => {
    const path = join(dir, "thread.md");
    await newThread(path, "slug", "ctx");
    await expect(newThread(path, "slug", "ctx")).rejects.toThrow(
      "already exists",
    );
  });

  test("rejects empty topic", async () => {
    await expect(newThread(join(dir, "t.md"), "   ", "ctx")).rejects.toThrow(
      "topic must not be empty",
    );
  });

  test("rejects multi-line topic", async () => {
    await expect(
      newThread(join(dir, "t.md"), "line1\nline2", "ctx"),
    ).rejects.toThrow("single line");
  });

  test("rejects context containing -->", async () => {
    await expect(
      newThread(join(dir, "t.md"), "slug", "bad --> here"),
    ).rejects.toThrow("-->");
  });
});

// ---------------------------------------------------------------------------
// appendTurn
// ---------------------------------------------------------------------------

describe("appendTurn", () => {
  test("appends agent turn with hyphen attribution", async () => {
    const path = join(dir, "thread.md");
    await newThread(path, "slug", "ctx");
    await appendTurn(path, "agent", "claude-opus-4-7", "hello");
    const data = await Bun.file(path).text();
    expect(data).toContain("## Round 1 (agent) - @claude-opus-4-7");
    expect(data).toContain("hello");
  });

  test("appends human turn without attribution", async () => {
    const path = join(dir, "thread.md");
    await newThread(path, "slug", "ctx");
    await appendTurn(path, "agent", "m", "first");
    await appendTurn(path, "human", "", "reply");
    const data = await Bun.file(path).text();
    // Header line must end right after the role parens, no attribution.
    expect(data).toMatch(/^## Round 1 \(human\)\s*$/m);
  });

  test("ignores model for human turns", async () => {
    const path = join(dir, "thread.md");
    await newThread(path, "slug", "ctx");
    await appendTurn(path, "agent", "m", "first");
    await appendTurn(path, "human", "some-model", "reply");
    const data = await Bun.file(path).text();
    expect(data).toContain("## Round 1 (human)\n");
  });

  test("numbers rounds per nextRound rules", async () => {
    const path = join(dir, "thread.md");
    await newThread(path, "slug", "ctx");
    const r1 = await appendTurn(path, "agent", "m", "a1");
    const r2 = await appendTurn(path, "human", "", "h1");
    const r3 = await appendTurn(path, "agent", "m", "a2");
    expect(r1).toBe(1);
    expect(r2).toBe(1);
    expect(r3).toBe(2);
  });

  test("defaults model to 'unknown' when empty for agent turns", async () => {
    const path = join(dir, "thread.md");
    await newThread(path, "slug", "ctx");
    await appendTurn(path, "agent", "", "body");
    const data = await Bun.file(path).text();
    expect(data).toContain("@unknown");
  });

  test("errors on converged thread", async () => {
    const path = join(dir, "thread.md");
    await newThread(path, "slug", "ctx");
    await appendTurn(path, "agent", "m", "body");
    await converge(path, "done");
    await expect(appendTurn(path, "human", "", "reply")).rejects.toThrow(
      "converged",
    );
  });

  test("preserves extra frontmatter fields on write", async () => {
    const path = join(dir, "thread.md");
    const content =
      "---\nstatus: open\ntitle: Keep Me\n---\n\n# slug\n\n<!-- ctx -->\n";
    await writeFile(path, content);
    await appendTurn(path, "agent", "m", "body");
    const data = await Bun.file(path).text();
    expect(data).toContain("title: Keep Me");
  });

  test("preserves trailing whitespace on the prior last line", async () => {
    // Markdown hard break = two trailing spaces. trimEnd() would silently
    // strip them and mutate the prior turn body, breaking append-only.
    const path = join(dir, "thread.md");
    const content =
      "---\nstatus: open\n---\n\n# slug\n\n<!-- ctx -->\n\n---\n\n## Round 1 (agent) - @m\n\nfirst line  \nsecond line\n";
    await writeFile(path, content);
    await appendTurn(path, "human", "", "reply");
    const data = await Bun.file(path).text();
    expect(data).toContain("first line  \nsecond line");
  });
});

// ---------------------------------------------------------------------------
// converge
// ---------------------------------------------------------------------------

describe("converge", () => {
  test("appends Outcome section", async () => {
    const path = join(dir, "thread.md");
    await newThread(path, "slug", "ctx");
    await appendTurn(path, "agent", "m", "body");
    await converge(path, "outcome text");
    const data = await Bun.file(path).text();
    expect(data).toContain("## Outcome");
    expect(data).toContain("outcome text");
  });

  test("flips status open -> converged via in-place regex rewrite", async () => {
    const path = join(dir, "thread.md");
    await newThread(path, "slug", "ctx");
    await converge(path, "done");
    const th = await parse(path);
    expect(th.status).toBe("converged");
  });

  test("does not rewrite prior turn bodies", async () => {
    const path = join(dir, "thread.md");
    await newThread(path, "slug", "ctx");
    await appendTurn(path, "agent", "m", "original body");
    await converge(path, "done");
    const th = await parse(path);
    expect(th.turns[0].body).toBe("original body");
  });

  test("preserves trailing whitespace on the prior last line", async () => {
    const path = join(dir, "thread.md");
    const content =
      "---\nstatus: open\n---\n\n# slug\n\n<!-- ctx -->\n\n---\n\n## Round 1 (agent) - @m\n\nfirst line  \nsecond line\n";
    await writeFile(path, content);
    await converge(path, "done");
    const data = await Bun.file(path).text();
    expect(data).toContain("first line  \nsecond line");
  });

  test("preserves extra frontmatter fields", async () => {
    const path = join(dir, "thread.md");
    const content =
      "---\nstatus: open\ntitle: Keep Me\n---\n\n# slug\n\n<!-- ctx -->\n";
    await writeFile(path, content);
    await converge(path, "done");
    const data = await Bun.file(path).text();
    expect(data).toContain("title: Keep Me");
    expect(data).toContain("status: converged");
  });

  test("errors when already converged", async () => {
    const path = join(dir, "thread.md");
    await newThread(path, "slug", "ctx");
    await converge(path, "done");
    await expect(converge(path, "again")).rejects.toThrow("already converged");
  });

  test("flips status with arbitrary whitespace (status:open, status:  open)", async () => {
    for (const line of ["status:open", "status:  open", "status:\topen"]) {
      const path = join(dir, `t-${line.replace(/\s/g, "_")}.md`);
      await writeFile(path, `---\n${line}\n---\n\n# slug\n\n<!-- ctx -->\n`);
      await converge(path, "done");
      const data = await Bun.file(path).text();
      expect(data).toContain("status: converged");
      expect(data).not.toMatch(/^status:\s*open\s*$/m);
    }
  });

  test("does not flip a literal 'status: open' line inside a turn body", async () => {
    const path = join(dir, "thread.md");
    await newThread(path, "slug", "ctx");
    // A turn body that quotes frontmatter syntax, e.g. an agent discussing
    // the protocol itself.
    const turnBody = "discussing frontmatter:\n\n    status: open\n\nas above.";
    await appendTurn(path, "agent", "m", turnBody);
    await converge(path, "done");
    const data = await Bun.file(path).text();
    // Frontmatter flipped exactly once.
    expect((data.match(/status: converged/g) ?? []).length).toBe(1);
    // The literal `status: open` inside the turn body survives.
    expect(data).toContain("    status: open");
    const th = await parse(path);
    expect(th.status).toBe("converged");
    expect(th.turns[0].body).toContain("status: open");
  });
});

// ---------------------------------------------------------------------------
// listThreads
// ---------------------------------------------------------------------------

describe("listThreads", () => {
  test("returns empty list when dir does not exist", async () => {
    const result = await listThreads(join(dir, "nonexistent"));
    expect(result).toEqual([]);
  });

  test("filters open threads by default", async () => {
    const a = join(dir, "a.md");
    const b = join(dir, "b.md");
    await newThread(a, "open-one", "ctx");
    await newThread(b, "open-two", "ctx");
    await converge(b, "done");
    const result = await listThreads(dir);
    expect(result).toHaveLength(1);
    expect(result[0].topic).toBe("open-one");
  });

  test("filters by converged", async () => {
    const a = join(dir, "a.md");
    const b = join(dir, "b.md");
    await newThread(a, "open-one", "ctx");
    await newThread(b, "closed-one", "ctx");
    await converge(b, "done");
    const result = await listThreads(dir, "converged");
    expect(result).toHaveLength(1);
    expect(result[0].topic).toBe("closed-one");
  });

  test("filter all returns both statuses", async () => {
    const a = join(dir, "a.md");
    const b = join(dir, "b.md");
    await newThread(a, "open-one", "ctx");
    await newThread(b, "closed-one", "ctx");
    await converge(b, "done");
    const result = await listThreads(dir, "all");
    expect(result).toHaveLength(2);
  });

  test("sorts by mtime descending", async () => {
    const older = join(dir, "a.md");
    const newer = join(dir, "b.md");
    await newThread(older, "older", "ctx");
    await newThread(newer, "newer", "ctx");
    const old = new Date("2026-01-01");
    const fresh = new Date("2026-01-02");
    await utimes(older, old, old);
    await utimes(newer, fresh, fresh);
    const result = await listThreads(dir, "all");
    expect(result[0].topic).toBe("newer");
    expect(result[1].topic).toBe("older");
  });

  test("skips malformed files silently", async () => {
    const good = join(dir, "good.md");
    const bad = join(dir, "bad.md");
    await newThread(good, "valid", "ctx");
    await writeFile(bad, "not a valid thread file");
    const result = await listThreads(dir, "all");
    expect(result).toHaveLength(1);
    expect(result[0].topic).toBe("valid");
  });

  test("rounds reflects max round number", async () => {
    const path = join(dir, "a.md");
    await newThread(path, "slug", "ctx");
    await appendTurn(path, "agent", "m", "a1");
    await appendTurn(path, "human", "", "h1");
    await appendTurn(path, "agent", "m", "a2");
    const result = await listThreads(dir, "all");
    expect(result[0].rounds).toBe(2);
  });
});
