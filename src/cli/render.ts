import { Marked } from "marked";
import { markedTerminal } from "marked-terminal";

// @types/marked-terminal types markedTerminal() as TerminalRenderer, but
// marked.use() expects a MarkedExtension. Runtime works; the published
// .d.ts files just don't agree on the integration shape.
const marked = new Marked().use(markedTerminal() as never);

export function renderMarkdown(text: string): string {
  const out = marked.parse(text);
  return typeof out === "string" ? out : text;
}
