import { describe, expect, test } from "bun:test";
import { renderMarkdown } from "./render.ts";

describe("renderMarkdown", () => {
  test("returns a string for plain markdown input", () => {
    const out = renderMarkdown("# hello\n\nbody\n");
    expect(typeof out).toBe("string");
    expect(out).toContain("hello");
    expect(out).toContain("body");
  });

  test("transforms input (does not pass markdown through verbatim)", () => {
    // The exact ANSI bytes depend on the terminal/chalk environment, so this
    // assertion stays loose: confirm the renderer did *something* (the H1
    // marker was rewritten, not just echoed).
    const input = "# heading\n";
    const out = renderMarkdown(input);
    expect(out).not.toBe(input);
    expect(out).toContain("heading");
  });

  test("renders fenced code blocks", () => {
    const out = renderMarkdown("```js\nconst x = 1;\n```\n");
    expect(out).toContain("const x = 1;");
  });
});
