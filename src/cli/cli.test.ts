import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../..");
const BIN = join(ROOT, "dist/lazychat-test");
const encoder = new TextEncoder();

interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

async function run(
  args: string[],
  opts: { cwd?: string; stdin?: string; env?: Record<string, string> } = {},
): Promise<RunResult> {
  const proc = Bun.spawn([BIN, ...args], {
    cwd: opts.cwd,
    env: opts.env,
    stdin: opts.stdin !== undefined ? encoder.encode(opts.stdin) : "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { stdout, stderr, exitCode };
}

beforeAll(async () => {
  const proc = Bun.spawn(
    [
      "bun",
      "build",
      "--compile",
      "--target=bun",
      `--outfile=${BIN}`,
      "src/cli/index.ts",
    ],
    { cwd: ROOT, stdout: "pipe", stderr: "pipe" },
  );
  const code = await proc.exited;
  if (code !== 0) {
    const err = await new Response(proc.stderr).text();
    throw new Error(`build failed: ${err}`);
  }
}, 60_000);

afterAll(async () => {
  await rm(BIN, { force: true });
});

async function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "lazychat-test-"));
}

async function writeThread(
  dir: string,
  name: string,
  content: string,
): Promise<string> {
  const lazyai = join(dir, ".lazyai");
  await mkdir(lazyai, { recursive: true });
  const path = join(lazyai, name);
  await writeFile(path, content, "utf8");
  return path;
}

const OPEN_THREAD = `---\nstatus: open\n---\n\n# test-topic\n\n<!-- context -->\n`;
const CONVERGED_THREAD =
  `---\nstatus: converged\n---\n\n# converged-topic\n\n<!-- context -->\n\n---\n\n` +
  `## Round 1 (human)\n\nhello\n\n---\n\n## Outcome\n\ndone\n`;
const THREAD_WITH_TURNS =
  `---\nstatus: open\n---\n\n# test\n\n<!-- ctx -->\n\n---\n\n` +
  `## Round 1 (human)\n\nhello\n\n---\n\n## Round 2 (agent) — @claude-opus-4-5\n\nworld\n`;

// ── new ──────────────────────────────────────────────────────────────────────

describe("lazychat new", () => {
  test("creates file at .lazyai/YYYY-MM-DDTHHMM-<slug>.md and prints path", async () => {
    const dir = await tempDir();
    try {
      const { stdout, exitCode } = await run(["new", "my-topic"], {
        cwd: dir,
      });
      expect(exitCode).toBe(0);
      expect(stdout.trim()).toMatch(
        /^\.lazyai\/\d{4}-\d{2}-\d{2}T\d{4}-my-topic\.md$/,
      );
      expect(await Bun.file(join(dir, stdout.trim())).exists()).toBe(true);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  test("--context - reads stdin into the HTML comment below the heading", async () => {
    const dir = await tempDir();
    try {
      const { stdout, exitCode } = await run(
        ["new", "ctx-test", "--context", "-"],
        { cwd: dir, stdin: "custom context paragraph" },
      );
      expect(exitCode).toBe(0);
      const content = await Bun.file(join(dir, stdout.trim())).text();
      expect(content).toContain("<!-- custom context paragraph -->");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  test("rejects --context values other than '-'", async () => {
    const dir = await tempDir();
    try {
      const { stderr, exitCode } = await run(
        ["new", "slug", "--context", "literal"],
        { cwd: dir },
      );
      expect(exitCode).toBe(2);
      expect(stderr).toContain("--context only accepts '-'");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  test("rejects topics that slugify to empty", async () => {
    const dir = await tempDir();
    try {
      const { stderr, exitCode } = await run(["new", "!!!"], { cwd: dir });
      expect(exitCode).toBe(2);
      expect(stderr).toContain("empty slug");
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});

// ── reply ─────────────────────────────────────────────────────────────────────

describe("lazychat reply", () => {
  test("appends agent turn with model attribution", async () => {
    const dir = await tempDir();
    try {
      const path = await writeThread(dir, "2026-01-01T0000-t.md", OPEN_THREAD);
      const { exitCode } = await run(
        [
          "reply",
          path,
          "--as",
          "agent",
          "--model",
          "claude-opus-4-5",
          "--body",
          "hi",
        ],
        { cwd: dir },
      );
      expect(exitCode).toBe(0);
      const content = await Bun.file(path).text();
      expect(content).toContain("## Round 1 (agent) — @claude-opus-4-5");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  test("appends human turn without model attribution", async () => {
    const dir = await tempDir();
    try {
      const path = await writeThread(dir, "2026-01-01T0000-t.md", OPEN_THREAD);
      const { exitCode } = await run(
        ["reply", path, "--as", "human", "--body", "a human reply"],
        { cwd: dir },
      );
      expect(exitCode).toBe(0);
      const content = await Bun.file(path).text();
      expect(content).toContain("## Round 1 (human)");
      expect(content).not.toContain(" — @");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  test("prints 'appended round N (role) to file' on success", async () => {
    const dir = await tempDir();
    try {
      const path = await writeThread(dir, "2026-01-01T0000-t.md", OPEN_THREAD);
      const { stdout, exitCode } = await run(
        ["reply", path, "--as", "human", "--body", "hello"],
        { cwd: dir },
      );
      expect(exitCode).toBe(0);
      expect(stdout).toContain("appended round 1 (human) to");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  test("--stdin reads body from stdin", async () => {
    const dir = await tempDir();
    try {
      const path = await writeThread(dir, "2026-01-01T0000-t.md", OPEN_THREAD);
      const { exitCode } = await run(
        ["reply", path, "--as", "human", "--stdin"],
        { cwd: dir, stdin: "from stdin" },
      );
      expect(exitCode).toBe(0);
      expect(await Bun.file(path).text()).toContain("from stdin");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  test("errors when both --stdin and --body are given", async () => {
    const dir = await tempDir();
    try {
      const path = await writeThread(dir, "2026-01-01T0000-t.md", OPEN_THREAD);
      const { stderr, exitCode } = await run(
        ["reply", path, "--as", "human", "--stdin", "--body", "x"],
        { cwd: dir, stdin: "x" },
      );
      expect(exitCode).toBe(2);
      expect(stderr).toContain("mutually exclusive");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  test("errors when agent turn has neither --stdin nor --body", async () => {
    const dir = await tempDir();
    try {
      const path = await writeThread(dir, "2026-01-01T0000-t.md", OPEN_THREAD);
      const { stderr, exitCode } = await run(
        ["reply", path, "--as", "agent", "--model", "m"],
        { cwd: dir },
      );
      expect(exitCode).toBe(2);
      expect(stderr).toContain("--stdin or --body must be provided");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  test("errors when --as is missing", async () => {
    const dir = await tempDir();
    try {
      const path = await writeThread(dir, "2026-01-01T0000-t.md", OPEN_THREAD);
      const { stderr, exitCode } = await run(["reply", path, "--body", "x"], {
        cwd: dir,
      });
      expect(exitCode).toBe(2);
      expect(stderr).toContain("--as");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  test("errors writing to a converged thread", async () => {
    const dir = await tempDir();
    try {
      const path = await writeThread(
        dir,
        "2026-01-01T0000-t.md",
        CONVERGED_THREAD,
      );
      const { stderr, exitCode } = await run(
        ["reply", path, "--as", "human", "--body", "late"],
        { cwd: dir },
      );
      expect(exitCode).toBe(1);
      expect(stderr).toContain("converged");
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});

// ── reply --editor ────────────────────────────────────────────────────────────

describe("lazychat reply --editor", () => {
  test("writes editor buffer as the human turn body", async () => {
    const dir = await tempDir();
    try {
      const path = await writeThread(
        dir,
        "2026-01-01T0000-t.md",
        THREAD_WITH_TURNS,
      );
      const fixture = join(dir, "fixture.txt");
      await writeFile(fixture, "my edited reply\n");
      const { exitCode } = await run(
        ["reply", path, "--as", "human", "--editor"],
        { cwd: dir, env: { ...process.env, EDITOR: `cp ${fixture}` } },
      );
      expect(exitCode).toBe(0);
      const content = await Bun.file(path).text();
      expect(content).toContain("my edited reply");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  test("pre-populates buffer with the last turn quoted", async () => {
    const dir = await tempDir();
    try {
      const path = await writeThread(
        dir,
        "2026-01-01T0000-t.md",
        THREAD_WITH_TURNS,
      );
      const captured = join(dir, "captured.md");
      const capturingEditor = `sh -c 'cat "$1" > ${captured}' --`;
      await run(["reply", path, "--as", "human", "--editor"], {
        cwd: dir,
        env: { ...process.env, EDITOR: capturingEditor },
      });
      const buffer = await Bun.file(captured).text();
      expect(buffer).toContain("> world");
      expect(buffer).toContain("lazychat: write your reply below");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  test("aborts when editor leaves buffer empty", async () => {
    const dir = await tempDir();
    try {
      const path = await writeThread(
        dir,
        "2026-01-01T0000-t.md",
        THREAD_WITH_TURNS,
      );
      const empty = join(dir, "empty.txt");
      await writeFile(empty, "");
      const before = await Bun.file(path).text();
      const { exitCode, stderr } = await run(
        ["reply", path, "--as", "human", "--editor"],
        { cwd: dir, env: { ...process.env, EDITOR: `cp ${empty}` } },
      );
      expect(exitCode).toBe(0);
      expect(stderr).toContain("nothing appended");
      expect(await Bun.file(path).text()).toBe(before);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  test("aborts when editor leaves template unchanged", async () => {
    const dir = await tempDir();
    try {
      const path = await writeThread(
        dir,
        "2026-01-01T0000-t.md",
        THREAD_WITH_TURNS,
      );
      const before = await Bun.file(path).text();
      const { exitCode, stderr } = await run(
        ["reply", path, "--as", "human", "--editor"],
        { cwd: dir, env: { ...process.env, EDITOR: "true" } },
      );
      expect(exitCode).toBe(0);
      expect(stderr).toContain("nothing appended");
      expect(await Bun.file(path).text()).toBe(before);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  test("--as human with no source defaults to editor", async () => {
    const dir = await tempDir();
    try {
      const path = await writeThread(dir, "2026-01-01T0000-t.md", OPEN_THREAD);
      const fixture = join(dir, "fixture.txt");
      await writeFile(fixture, "default-editor reply\n");
      const { exitCode } = await run(["reply", path, "--as", "human"], {
        cwd: dir,
        env: { ...process.env, EDITOR: `cp ${fixture}` },
      });
      expect(exitCode).toBe(0);
      expect(await Bun.file(path).text()).toContain("default-editor reply");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  test("rejects --editor for --as agent", async () => {
    const dir = await tempDir();
    try {
      const path = await writeThread(dir, "2026-01-01T0000-t.md", OPEN_THREAD);
      const { exitCode, stderr } = await run(
        ["reply", path, "--as", "agent", "--editor"],
        { cwd: dir },
      );
      expect(exitCode).toBe(2);
      expect(stderr).toContain("--editor is only valid for --as human");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  test("rejects --editor combined with --body", async () => {
    const dir = await tempDir();
    try {
      const path = await writeThread(dir, "2026-01-01T0000-t.md", OPEN_THREAD);
      const { exitCode, stderr } = await run(
        ["reply", path, "--as", "human", "--editor", "--body", "x"],
        { cwd: dir },
      );
      expect(exitCode).toBe(2);
      expect(stderr).toContain("mutually exclusive");
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});

// ── open ──────────────────────────────────────────────────────────────────────

describe("lazychat open", () => {
  test("spawns $EDITOR on the thread file", async () => {
    const dir = await tempDir();
    try {
      const path = await writeThread(dir, "2026-01-01T0000-t.md", OPEN_THREAD);
      const marker = join(dir, "opened-with");
      const editor = `sh -c 'printf "%s" "$1" > ${marker}' --`;
      const { exitCode } = await run(["open", path], {
        cwd: dir,
        env: { ...process.env, EDITOR: editor },
      });
      expect(exitCode).toBe(0);
      expect(await Bun.file(marker).text()).toBe(path);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  test("errors when file does not exist", async () => {
    const dir = await tempDir();
    try {
      const { exitCode, stderr } = await run(["open", "nope.md"], {
        cwd: dir,
      });
      expect(exitCode).toBe(1);
      expect(stderr).toContain("file not found");
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});

// ── converge ──────────────────────────────────────────────────────────────────

describe("lazychat converge", () => {
  test("appends Outcome and flips status to converged", async () => {
    const dir = await tempDir();
    try {
      const path = await writeThread(dir, "2026-01-01T0000-t.md", OPEN_THREAD);
      const { exitCode } = await run(
        ["converge", path, "--body", "we agreed"],
        { cwd: dir },
      );
      expect(exitCode).toBe(0);
      const content = await Bun.file(path).text();
      expect(content).toContain("status: converged");
      expect(content).toContain("## Outcome");
      expect(content).toContain("we agreed");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  test("errors when thread is already converged", async () => {
    const dir = await tempDir();
    try {
      const path = await writeThread(
        dir,
        "2026-01-01T0000-t.md",
        CONVERGED_THREAD,
      );
      const { stderr, exitCode } = await run(
        ["converge", path, "--body", "again"],
        { cwd: dir },
      );
      expect(exitCode).toBe(1);
      expect(stderr).toContain("already converged");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  test("preserves extra frontmatter fields", async () => {
    const dir = await tempDir();
    try {
      const thread = `---\nstatus: open\ntags: [foo, bar]\nauthor: test\n---\n\n# t\n\n<!-- ctx -->\n`;
      const path = await writeThread(dir, "2026-01-01T0000-t.md", thread);
      await run(["converge", path, "--body", "done"], { cwd: dir });
      const content = await Bun.file(path).text();
      expect(content).toContain("tags: [foo, bar]");
      expect(content).toContain("author: test");
      expect(content).toContain("status: converged");
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});

// ── list ──────────────────────────────────────────────────────────────────────

describe("lazychat list", () => {
  test("exits silently when .lazyai does not exist", async () => {
    const dir = await tempDir();
    try {
      const { stdout, stderr, exitCode } = await run(["list"], { cwd: dir });
      expect(exitCode).toBe(0);
      expect(stdout).toBe("");
      expect(stderr).toBe("");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  test("filters open / converged / all", async () => {
    const dir = await tempDir();
    try {
      await writeThread(dir, "2026-01-01T0001-open.md", OPEN_THREAD);
      await writeThread(dir, "2026-01-01T0002-conv.md", CONVERGED_THREAD);

      const { stdout: openOut } = await run(["list", "--status", "open"], {
        cwd: dir,
      });
      expect(openOut).toContain("test-topic");
      expect(openOut).not.toContain("converged-topic");

      const { stdout: convOut } = await run(["list", "--status", "converged"], {
        cwd: dir,
      });
      expect(convOut).toContain("converged-topic");
      expect(convOut).not.toContain("test-topic");

      const { stdout: allOut } = await run(["list", "--status", "all"], {
        cwd: dir,
      });
      expect(allOut).toContain("test-topic");
      expect(allOut).toContain("converged-topic");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  test("sorts by mtime descending", async () => {
    const dir = await tempDir();
    try {
      const older = await writeThread(
        dir,
        "2026-01-01T0001-older.md",
        OPEN_THREAD,
      );
      const newer = await writeThread(
        dir,
        "2026-01-01T0002-newer.md",
        OPEN_THREAD,
      );
      await utimes(older, new Date("2026-01-01"), new Date("2026-01-01"));
      await utimes(newer, new Date("2026-01-02"), new Date("2026-01-02"));

      const { stdout } = await run(["list"], { cwd: dir });
      const lines = stdout.trim().split("\n");
      expect(lines[0]).toContain("newer");
      expect(lines[1]).toContain("older");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  test("skips malformed files without erroring the whole list", async () => {
    const dir = await tempDir();
    try {
      await writeThread(dir, "2026-01-01T0001-bad.md", "no frontmatter");
      await writeThread(dir, "2026-01-01T0002-good.md", OPEN_THREAD);
      const { stdout, exitCode } = await run(["list"], { cwd: dir });
      expect(exitCode).toBe(0);
      expect(stdout).toContain("test-topic");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  test("formats columns with tabwriter-style alignment", async () => {
    const dir = await tempDir();
    try {
      await writeThread(dir, "2026-01-01T0001-a.md", OPEN_THREAD);
      await writeThread(dir, "2026-01-01T0002-b.md", CONVERGED_THREAD);
      const { stdout } = await run(["list", "--status", "all"], { cwd: dir });
      const lines = stdout.trim().split("\n");
      expect(lines.length).toBe(2);
      // Both lines should have the path column starting at the same offset
      const pathCol = lines.map((l) => l.indexOf(".lazyai"));
      expect(pathCol[0]).toBe(pathCol[1]);
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});

// ── show ──────────────────────────────────────────────────────────────────────

describe("lazychat show", () => {
  test("no flag prints whole file", async () => {
    const dir = await tempDir();
    try {
      const path = await writeThread(
        dir,
        "2026-01-01T0000-t.md",
        THREAD_WITH_TURNS,
      );
      const { stdout, exitCode } = await run(["show", path], { cwd: dir });
      expect(exitCode).toBe(0);
      expect(stdout).toBe(THREAD_WITH_TURNS);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  test("--round N prints turns at that round joined by --- separators", async () => {
    const dir = await tempDir();
    try {
      const path = await writeThread(
        dir,
        "2026-01-01T0000-t.md",
        THREAD_WITH_TURNS,
      );
      const { stdout, exitCode } = await run(["show", path, "--round", "1"], {
        cwd: dir,
      });
      expect(exitCode).toBe(0);
      expect(stdout).toContain("## Round 1 (human)");
      expect(stdout).toContain("hello");
      expect(stdout).not.toContain("world");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  test("--last prints the last turn in file order", async () => {
    const dir = await tempDir();
    try {
      const path = await writeThread(
        dir,
        "2026-01-01T0000-t.md",
        THREAD_WITH_TURNS,
      );
      const { stdout, exitCode } = await run(["show", path, "--last"], {
        cwd: dir,
      });
      expect(exitCode).toBe(0);
      expect(stdout).toContain("## Round 2 (agent)");
      expect(stdout).toContain("world");
      expect(stdout).not.toContain("hello");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  test("--since N prints turns where round >= N (inclusive)", async () => {
    const dir = await tempDir();
    try {
      const path = await writeThread(
        dir,
        "2026-01-01T0000-t.md",
        THREAD_WITH_TURNS,
      );
      const { stdout, exitCode } = await run(["show", path, "--since", "2"], {
        cwd: dir,
      });
      expect(exitCode).toBe(0);
      expect(stdout).toContain("## Round 2");
      expect(stdout).not.toContain("## Round 1");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  test("--since N includes same-round turns after the agent wrote them", async () => {
    const dir = await tempDir();
    try {
      const path = await writeThread(
        dir,
        "2026-01-01T0000-t.md",
        THREAD_WITH_TURNS,
      );
      const { stdout, exitCode } = await run(["show", path, "--since", "1"], {
        cwd: dir,
      });
      expect(exitCode).toBe(0);
      expect(stdout).toContain("## Round 1 (human)");
      expect(stdout).toContain("## Round 2");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  test("errors when more than one selector flag is given", async () => {
    const dir = await tempDir();
    try {
      const path = await writeThread(
        dir,
        "2026-01-01T0000-t.md",
        THREAD_WITH_TURNS,
      );
      const { stderr, exitCode } = await run(
        ["show", path, "--last", "--since", "1"],
        { cwd: dir },
      );
      expect(exitCode).toBe(2);
      expect(stderr).toContain("mutually exclusive");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  test("errors with exit 2 when --round is not a positive integer", async () => {
    const dir = await tempDir();
    try {
      const path = await writeThread(
        dir,
        "2026-01-01T0000-t.md",
        THREAD_WITH_TURNS,
      );
      for (const bad of ["foo", "1.5", "1.0", "0", "-3", "1e2", "0x10", "01"]) {
        const { stderr, exitCode } = await run(["show", path, "--round", bad], {
          cwd: dir,
        });
        expect(exitCode).toBe(2);
        expect(stderr).toContain("--round requires a positive integer");
      }
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  test("errors with exit 2 when --since is not a positive integer", async () => {
    const dir = await tempDir();
    try {
      const path = await writeThread(
        dir,
        "2026-01-01T0000-t.md",
        THREAD_WITH_TURNS,
      );
      const { stderr, exitCode } = await run(["show", path, "--since", "bar"], {
        cwd: dir,
      });
      expect(exitCode).toBe(2);
      expect(stderr).toContain("--since requires a positive integer");
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});

// ── status ────────────────────────────────────────────────────────────────────

describe("lazychat status", () => {
  test("prints raw frontmatter, rounds count, and updated timestamp", async () => {
    const dir = await tempDir();
    try {
      const thread = `---\nstatus: open\n---\n\n# test\n\n<!-- ctx -->\n\n---\n\n## Round 1 (human)\n\nhello\n`;
      const path = await writeThread(dir, "2026-01-01T0000-t.md", thread);
      const { stdout, exitCode } = await run(["status", path], { cwd: dir });
      expect(exitCode).toBe(0);
      expect(stdout).toContain("status: open");
      expect(stdout).toContain("rounds: 1");
      expect(stdout).toMatch(/updated: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  test("reports max round number, not parsed turn count", async () => {
    const dir = await tempDir();
    try {
      // Two Round 2 turns (gap at Round 1) — turns.length=2, max round=2.
      const thread =
        `---\nstatus: open\n---\n\n# gap-test\n\n<!-- ctx -->\n\n---\n\n` +
        `## Round 2 (agent) — @x\n\nfirst\n\n---\n\n## Round 2 (human)\n\nsecond\n`;
      const path = await writeThread(dir, "2026-01-01T0000-t.md", thread);
      const { stdout } = await run(["status", path], { cwd: dir });
      expect(stdout).toContain("rounds: 2");
      const { stdout: json } = await run(["status", path, "--json"], {
        cwd: dir,
      });
      expect(JSON.parse(json).rounds).toBe(2);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  test("--json outputs a valid JSON object", async () => {
    const dir = await tempDir();
    try {
      const thread = `---\nstatus: open\n---\n\n# my-topic\n\n<!-- ctx -->\n\n---\n\n## Round 1 (human)\n\nhello\n`;
      const path = await writeThread(dir, "2026-01-01T0000-t.md", thread);
      const { stdout, exitCode } = await run(["status", path, "--json"], {
        cwd: dir,
      });
      expect(exitCode).toBe(0);
      const obj = JSON.parse(stdout);
      expect(obj.status).toBe("open");
      expect(obj.topic).toBe("my-topic");
      expect(obj.rounds).toBe(1);
      expect(typeof obj.updatedAt).toBe("string");
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});

// ── list --json ───────────────────────────────────────────────────────────────

describe("lazychat list --json", () => {
  test("outputs a valid JSON array with correct fields", async () => {
    const dir = await tempDir();
    try {
      await writeThread(dir, "2026-01-01T0001-open.md", OPEN_THREAD);
      await writeThread(dir, "2026-01-01T0002-conv.md", CONVERGED_THREAD);
      const { stdout, exitCode } = await run(
        ["list", "--status", "all", "--json"],
        { cwd: dir },
      );
      expect(exitCode).toBe(0);
      const arr = JSON.parse(stdout);
      expect(Array.isArray(arr)).toBe(true);
      expect(arr.length).toBe(2);
      const item = arr[0];
      expect(typeof item.path).toBe("string");
      expect(["open", "converged"]).toContain(item.status);
      expect(typeof item.topic).toBe("string");
      expect(typeof item.rounds).toBe("number");
      expect(typeof item.updatedAt).toBe("string");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  test("outputs empty array when no threads match", async () => {
    const dir = await tempDir();
    try {
      const { stdout, exitCode } = await run(["list", "--json"], { cwd: dir });
      expect(exitCode).toBe(0);
      expect(JSON.parse(stdout)).toEqual([]);
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});

// ── skill ─────────────────────────────────────────────────────────────────────

describe("lazychat skill", () => {
  test("prints bundled SKILL-CLI.md content verbatim", async () => {
    const expected = await Bun.file(join(ROOT, "SKILL-CLI.md")).text();
    const { stdout, exitCode } = await run(["skill"]);
    expect(exitCode).toBe(0);
    expect(stdout).toBe(expected);
  });
});

// ── onboard ───────────────────────────────────────────────────────────────────

describe("lazychat onboard", () => {
  test("prints the onboard prompt block followed by active threads", async () => {
    const dir = await tempDir();
    try {
      await writeThread(dir, "2026-01-01T0000-t.md", OPEN_THREAD);
      const { stdout, exitCode } = await run(["onboard"], { cwd: dir });
      expect(exitCode).toBe(0);
      expect(stdout).toContain(
        "lazychat — file-based async discussion protocol",
      );
      expect(stdout).toContain("# Active threads");
      expect(stdout).toContain(".lazyai/");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  test("prints the empty-case hint when no open threads exist", async () => {
    const dir = await tempDir();
    try {
      const { stdout, exitCode } = await run(["onboard"], { cwd: dir });
      expect(exitCode).toBe(0);
      expect(stdout).toContain("No active threads");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  test("prefixes every active-threads line with '# '", async () => {
    const dir = await tempDir();
    try {
      await writeThread(dir, "2026-01-01T0000-t.md", OPEN_THREAD);
      const { stdout } = await run(["onboard"], { cwd: dir });
      const marker =
        "\n# Active threads in this working tree (most recent first):\n";
      const afterHeader = stdout.split(marker)[1] ?? "";
      const lines = afterHeader
        .trim()
        .split("\n")
        .filter((l) => l.trim());
      expect(lines.length).toBeGreaterThan(0);
      expect(lines.every((l) => l.startsWith("# "))).toBe(true);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  test("caps active threads at 10, mtime desc", async () => {
    const dir = await tempDir();
    try {
      for (let i = 1; i <= 12; i++) {
        const name = `2026-01-${String(i).padStart(2, "0")}T0000-t${i}.md`;
        const path = await writeThread(
          dir,
          name,
          `---\nstatus: open\n---\n\n# thread${i}\n\n<!-- ctx -->\n`,
        );
        const d = new Date(`2026-01-${String(i).padStart(2, "0")}`);
        await utimes(path, d, d);
      }
      const { stdout } = await run(["onboard"], { cwd: dir });
      const marker =
        "\n# Active threads in this working tree (most recent first):\n";
      const threadLines = (stdout.split(marker)[1] ?? "")
        .trim()
        .split("\n")
        .filter((l) => l.startsWith("# ") && l.includes(".lazyai/"));
      expect(threadLines.length).toBeLessThanOrEqual(10);
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});
