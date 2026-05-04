import { Marked } from "marked";
import { markedTerminal } from "marked-terminal";

const marked = new Marked().use(markedTerminal());

export function renderMarkdown(text: string): string {
  const out = marked.parse(text);
  return typeof out === "string" ? out : text;
}
