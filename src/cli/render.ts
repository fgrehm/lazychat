import { Marked } from "marked";
import { markedTerminal } from "marked-terminal";

const marked = new Marked().use(markedTerminal());

// Failures here (a renderer/highlighter throwing, or a Promise return from
// an async extension) must not crash `lazychat show`. Fall back to raw
// markdown on any unexpected outcome so a TTY user sees the content even
// if the pretty-print path breaks.
export function renderMarkdown(text: string): string {
  try {
    const out = marked.parse(text);
    return typeof out === "string" ? out : text;
  } catch {
    return text;
  }
}
