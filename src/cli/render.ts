import { Marked } from "marked";
import { markedTerminal } from "marked-terminal";

// marked-terminal's renderer signature is loose against marked's strict
// Renderer type; the cast keeps the well-known integration working without
// fighting third-party typings.
const marked = new Marked().use(markedTerminal() as never);

export function renderMarkdown(text: string): string {
  const out = marked.parse(text);
  return typeof out === "string" ? out : text;
}
