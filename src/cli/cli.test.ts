import { describe, test } from "bun:test";

describe("lazychat new", () => {
  test.todo(
    "creates file at .lazyai/YYYY-MM-DDTHHMM-<slug>.md and prints path",
    () => {},
  );
  test.todo(
    "--context - reads stdin into the HTML comment below the heading",
    () => {},
  );
  test.todo("errors when target path already exists", () => {});
  test.todo("rejects --context values other than '-'", () => {});
});

describe("lazychat reply", () => {
  test.todo("appends agent turn with model attribution", () => {});
  test.todo("appends human turn without model attribution", () => {});
  test.todo("errors when both --stdin and --body are given", () => {});
  test.todo("errors when neither --stdin nor --body is given", () => {});
  test.todo("errors when --as is missing", () => {});
  test.todo("errors writing to a converged thread", () => {});
  test.todo(
    "prints 'appended round <N> (<role>) to <file>' on success",
    () => {},
  );
});

describe("lazychat converge", () => {
  test.todo("appends Outcome and flips status to converged", () => {});
  test.todo("errors when thread is already converged", () => {});
  test.todo("preserves extra frontmatter fields", () => {});
});

describe("lazychat list", () => {
  test.todo("filters open / converged / all", () => {});
  test.todo("sorts by mtime descending", () => {});
  test.todo("exits silently when .lazyai does not exist", () => {});
  test.todo("skips malformed files without erroring the whole list", () => {});
  test.todo("formats columns with tabwriter-style alignment", () => {});
});

describe("lazychat show", () => {
  test.todo("no flag prints whole file", () => {});
  test.todo(
    "--round N prints turns at that round joined by --- separators",
    () => {},
  );
  test.todo("--last prints the last turn in file order", () => {});
  test.todo("--since N prints turns where round > N", () => {});
  test.todo("errors when more than one selector flag is given", () => {});
});

describe("lazychat status", () => {
  test.todo(
    "prints raw frontmatter, rounds count, and updated timestamp",
    () => {},
  );
});

describe("lazychat onboard", () => {
  test.todo(
    "prints the onboard prompt block followed by active threads",
    () => {},
  );
  test.todo("caps active threads at 10, mtime desc", () => {});
  test.todo("prefixes every active-threads line with '# '", () => {});
  test.todo("prints the empty-case hint when no open threads exist", () => {});
});
