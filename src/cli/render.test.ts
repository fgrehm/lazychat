import { describe, expect, test } from "bun:test";
import { renderMarkdown } from "./render.ts";

describe("renderMarkdown", () => {
  test("returns a string for plain markdown input", () => {
    const out = renderMarkdown("# hello\n\nbody\n");
    expect(typeof out).toBe("string");
    expect(out).toContain("hello");
    expect(out).toContain("body");
  });

  test("does not emit HTML (marked-terminal is wired, default renderer is not)", () => {
    // Without marked-terminal, marked's default fallback for `# heading` is
    // `<h1>heading</h1>`. Asserting absence of HTML tags guards the
    // integration: if the renderer chain breaks and falls back to default,
    // this test fails loudly instead of silently emitting HTML.
    const out = renderMarkdown(
      "# heading\n\n**bold** and *italic*\n\n[link](https://example.com)\n",
    );
    expect(out).not.toMatch(/<h1>/);
    expect(out).not.toMatch(/<\/?(strong|em|a|p)\b/);
  });

  test("rewrites the H1 marker (does not echo input verbatim)", () => {
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
