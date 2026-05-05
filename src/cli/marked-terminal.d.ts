// Local module declaration. marked-terminal ships no types, and the
// DefinitelyTyped package (@types/marked-terminal@6) pins a peer of
// `marked: >=6.0.0 <12` which conflicts with the marked@^15 we depend on.
// Keep this minimal: the only API we use is `markedTerminal()` plugged
// into `Marked.use()`. Typing the return as MarkedExtension matches what
// `use()` expects at runtime.
declare module "marked-terminal" {
  import type { MarkedExtension } from "marked";
  export function markedTerminal(
    options?: Record<string, unknown>,
    highlightOptions?: Record<string, unknown>,
  ): MarkedExtension;
}
