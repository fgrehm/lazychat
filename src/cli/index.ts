#!/usr/bin/env bun

import { Command, CommanderError, type OptionValues } from "commander";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import SKILL_CLI from "../../SKILL-CLI.md" with { type: "text" };
import type { ListFilter } from "../thread/index.ts";
import {
  appendTurn,
  converge,
  listThreads,
  maxTurn,
  newThread,
  parse,
  slugifyTopic,
  timestampedPath,
} from "../thread/index.ts";
import { renderMarkdown } from "./render.ts";

const LAZYAI_DIR = ".lazyai";

const DEFAULT_CONTEXT =
  "One paragraph: what we are figuring out, why it matters, and what the target artifact is.";

const PROTOCOL_BLOCK = `\
lazychat: file-based async discussion protocol

Commands:
  new <topic-slug> [--context -]
      Create a new thread. Prints the file path on stdout.
      --context - reads one paragraph of context from stdin.

  reply <file> --as <agent|human> [--model <id>] [--stdin | --body <str>]
      Append a turn. --as is required. For agent turns, provide exactly one
      of --stdin or --body. --model is only meaningful for agent turns
      (default: unknown). Humans have additional flags; see "lazychat reply --help".

  converge <file> --stdin | --body <str>
      Append an Outcome section and mark the thread converged.
      Exactly one of --stdin or --body must be given.

  list [--status open|converged|all] [--json]
      List threads in .lazyai/, most recent first. Default: open.

  show <file> [--turn N | --last [N]]
      Print thread content. No flag prints the whole file.
      --turn N    print the turn with id N.
      --last [N]  print the last N turns (default 1).

  status <file> [--json]
      Print frontmatter, turn count, and last-updated timestamp.

  onboard
      Print this block and active threads.

Protocol rules:
  - Threads are append-only. Never edit prior turns.
  - Agent turns carry model attribution as " - @model-id" after the role.
  - Converged threads are read-only.
  - Thread files live in .lazyai/ in the current working tree.`;

async function readStdin(): Promise<string> {
  return (await Bun.stdin.text()).trimEnd();
}

const EDITOR_INSTRUCTIONS = `<!-- lazychat: write your reply below. Save empty or unchanged to abort. Lines quoted with '> ' are from the last turn. -->`;

async function spawnEditor(path: string): Promise<number> {
  // $EDITOR is interpolated into the shell command on purpose: users routinely
  // set it to a multi-token invocation like "code -w" or "vim -O". Treating it
  // as a single executable path (sh -c 'exec "$EDITOR" "$@"') would break
  // those, and matches git's own behavior. EDITOR is user-controlled env, not
  // attacker-controlled input, same trust boundary as $SHELL or $PATH.
  const editor = process.env["EDITOR"] || "vi";
  const proc = Bun.spawn(["sh", "-c", `exec ${editor} "$@"`, "sh", path], {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  return await proc.exited;
}

function stripInstructions(content: string): string {
  if (content.startsWith(EDITOR_INSTRUCTIONS)) {
    return content.slice(EDITOR_INSTRUCTIONS.length).replace(/^\s*\n+/, "");
  }
  return content;
}

async function composeReplyInEditor(file: string): Promise<string | null> {
  const thread = await parse(file);
  const lastTurn = thread.turns.at(-1);
  const quoted = lastTurn
    ? lastTurn.body
        .split("\n")
        .map((l) => (l === "" ? ">" : `> ${l}`))
        .join("\n")
    : "";
  const template = quoted
    ? `${EDITOR_INSTRUCTIONS}\n\n${quoted}\n\n`
    : `${EDITOR_INSTRUCTIONS}\n\n`;

  const dir = await mkdtemp(join(tmpdir(), "lazychat-reply-"));
  const tmpPath = join(dir, "REPLY.md");
  try {
    await Bun.write(tmpPath, template);
    const code = await spawnEditor(tmpPath);
    if (code !== 0) {
      process.stderr.write(
        `editor exited with code ${code}; nothing appended\n`,
      );
      return null;
    }
    const raw = await Bun.file(tmpPath).text();
    const body = stripInstructions(raw).trimEnd();
    const templateBody = stripInstructions(template).trimEnd();
    if (body === "" || body === templateBody) return null;
    return body;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function padTable(rows: string[][]): string {
  if (rows.length === 0) return "";
  const cols = rows[0].length;
  const widths = Array.from({ length: cols - 1 }, (_, i) =>
    rows.reduce((max, r) => Math.max(max, r[i]?.length ?? 0), 0),
  );
  return rows
    .map((row) =>
      row
        .map((cell, i) => (i < cols - 1 ? cell.padEnd(widths[i] + 2) : cell))
        .join(""),
    )
    .join("\n");
}

function fmtDate(d: Date, seconds = false): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const base = `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
  return seconds ? `${base}:${p(d.getUTCSeconds())}` : base;
}

// Commands

async function cmdNew(rawSlug: string, opts: OptionValues): Promise<void> {
  const context = opts["context"] as string | undefined;
  if (context !== undefined && context !== "-") {
    process.stderr.write(
      "error: --context only accepts '-' (read from stdin)\n",
    );
    process.exit(2);
  }
  const body = context === "-" ? await readStdin() : DEFAULT_CONTEXT;
  const slug = slugifyTopic(rawSlug);
  if (slug === "") {
    process.stderr.write(
      `error: topic ${JSON.stringify(rawSlug)} produces an empty slug; use at least one alphanumeric character\n`,
    );
    process.exit(2);
  }
  const path = timestampedPath(LAZYAI_DIR, slug, new Date());
  await newThread(path, slug, body);
  process.stdout.write(path + "\n");
  process.stderr.write(
    `Thread is ready at ${path}. Write the first turn with:\n` +
      `  lazychat reply ${path} --as agent --model <id> --stdin\n`,
  );
}

async function resolveBody(opts: OptionValues): Promise<string> {
  const useStdin = opts["stdin"] as boolean | undefined;
  const bodyOpt = opts["body"] as string | undefined;
  if (useStdin && bodyOpt !== undefined) {
    process.stderr.write("error: --stdin and --body are mutually exclusive\n");
    process.exit(2);
  }
  if (!useStdin && bodyOpt === undefined) {
    process.stderr.write("error: --stdin or --body must be provided\n");
    process.exit(2);
  }
  return useStdin ? await readStdin() : bodyOpt!;
}

async function cmdReply(file: string, opts: OptionValues): Promise<void> {
  const role = opts["as"] as string | undefined;
  if (!role || (role !== "agent" && role !== "human")) {
    process.stderr.write("error: --as <agent|human> is required\n");
    process.exit(2);
  }

  const useEditor = opts["editor"] as boolean | undefined;
  const useStdin = opts["stdin"] as boolean | undefined;
  const bodyOpt = opts["body"] as string | undefined;

  if (useEditor && role === "agent") {
    process.stderr.write("error: --editor is only valid for --as human\n");
    process.exit(2);
  }

  const sources = [useEditor, useStdin, bodyOpt !== undefined].filter(
    Boolean,
  ).length;
  if (sources > 1) {
    process.stderr.write(
      "error: --editor, --stdin, and --body are mutually exclusive\n",
    );
    process.exit(2);
  }

  // Default to editor for human turns when no source is given.
  const shouldEdit = useEditor || (sources === 0 && role === "human");

  let body: string;
  if (shouldEdit) {
    const result = await composeReplyInEditor(file);
    if (result === null) {
      process.stderr.write("no changes; nothing appended\n");
      return;
    }
    body = result;
  } else {
    body = await resolveBody(opts);
  }

  const model = (opts["model"] as string | undefined) ?? "";
  const id = await appendTurn(file, role, model, body);
  const otherSide = role === "agent" ? "human" : "agent";
  process.stdout.write(
    `appended turn ${id} (${role}) to ${file}\n` +
      `Tell the ${otherSide} to catch up with: lazychat show ${file} --last 1\n`,
  );
}

async function cmdOpen(file: string): Promise<void> {
  if (!(await Bun.file(file).exists())) {
    process.stderr.write(`error: file not found: ${file}\n`);
    process.exit(1);
  }
  const code = await spawnEditor(file);
  if (code !== 0) process.exit(code);
}

async function cmdConverge(file: string, opts: OptionValues): Promise<void> {
  const body = await resolveBody(opts);
  await converge(file, body);
}

async function cmdList(opts: OptionValues): Promise<void> {
  const filter = opts["status"] as string as ListFilter;
  if (filter !== "open" && filter !== "converged" && filter !== "all") {
    process.stderr.write("error: --status must be open, converged, or all\n");
    process.exit(2);
  }
  const summaries = await listThreads(LAZYAI_DIR, filter);
  if (opts["json"]) {
    process.stdout.write(
      JSON.stringify(
        summaries.map((s) => ({
          path: s.path,
          status: s.status,
          topic: s.topic,
          turns: s.turns,
          updatedAt: s.updatedAt.toISOString(),
        })),
        null,
        2,
      ) + "\n",
    );
    return;
  }
  if (summaries.length === 0) return;
  process.stdout.write(
    padTable(
      summaries.map((s) => [
        s.status,
        s.path,
        `${s.turns} turns`,
        fmtDate(s.updatedAt),
        s.topic,
      ]),
    ) + "\n",
  );
}

async function cmdShow(file: string, opts: OptionValues): Promise<void> {
  const turnOpt = opts["turn"] as string | undefined;
  // --last is variadic: boolean true (no value), or a string when a count is
  // passed. undefined means the flag was not given.
  const lastOpt = opts["last"] as string | boolean | undefined;

  if (turnOpt !== undefined && lastOpt !== undefined) {
    process.stderr.write("error: --turn and --last are mutually exclusive\n");
    process.exit(2);
  }

  // On a TTY, render through marked-terminal for human readers (colors,
  // code highlighting). On a pipe/redirect, emit raw markdown so agents and
  // tooling get a deterministic, parseable stream.
  const emit = (text: string) => {
    process.stdout.write(process.stdout.isTTY ? renderMarkdown(text) : text);
  };

  if (turnOpt === undefined && lastOpt === undefined) {
    emit(await Bun.file(file).text());
    return;
  }

  const parsePositiveInt = (raw: string, flag: string): number => {
    // Strict decimal integer ≥ 1; rejects "0", "01", "1e2", "0x10", "1.0", etc.
    if (!/^[1-9]\d*$/.test(raw)) {
      process.stderr.write(
        `error: ${flag} requires a positive integer, got ${JSON.stringify(raw)}\n`,
      );
      process.exit(2);
    }
    return Number(raw);
  };

  const thread = await parse(file);
  let selected;
  if (turnOpt !== undefined) {
    const n = parsePositiveInt(turnOpt, "--turn");
    selected = thread.turns.filter((t) => t.id === n);
  } else {
    const n =
      lastOpt === true ? 1 : parsePositiveInt(lastOpt as string, "--last");
    selected = thread.turns.slice(-n);
  }

  if (selected.length > 0) {
    emit(selected.map((t) => t.raw.trimEnd()).join("\n\n---\n\n") + "\n");
  }
}

async function cmdStatus(file: string, opts: OptionValues): Promise<void> {
  const thread = await parse(file);
  const turns = maxTurn(thread.turns);
  if (opts["json"]) {
    process.stdout.write(
      JSON.stringify(
        {
          status: thread.status,
          topic: thread.topic,
          turns,
          updatedAt: thread.updatedAt.toISOString(),
        },
        null,
        2,
      ) + "\n",
    );
    return;
  }
  process.stdout.write(
    [
      thread.frontmatterRaw.trim(),
      `turns: ${turns}`,
      `updated: ${fmtDate(thread.updatedAt, true)}`,
    ].join("\n") + "\n",
  );
}

async function cmdSkill(): Promise<void> {
  process.stdout.write(SKILL_CLI);
}

async function cmdOnboard(): Promise<void> {
  const summaries = await listThreads(LAZYAI_DIR, "open");
  const active = summaries.slice(0, 10);
  process.stdout.write(PROTOCOL_BLOCK + "\n");
  process.stdout.write(
    "\n# Active threads in this working tree (most recent first):\n",
  );
  if (active.length === 0) {
    process.stdout.write(
      "# No active threads in .lazyai/. Use `lazychat new <topic-slug>` to start one.\n",
    );
  } else {
    for (const s of active) {
      process.stdout.write(
        `# ${fmtDate(s.updatedAt)}  ${s.path}  ${s.topic}\n`,
      );
    }
  }
}

// CLI wiring

const program = new Command("lazychat")
  .description("File-based async discussion protocol")
  .showSuggestionAfterError();

program
  .command("new <topic-slug>")
  .description("Create a new thread. Prints the file path on stdout.")
  .option("--context <source>", "Context source ('-' reads from stdin)")
  .action(cmdNew);

program
  .command("reply <file>")
  .description("Append a turn to a thread.")
  .option("--as <role>", "Role: agent or human (required)")
  .option("--model <id>", "Model ID (agent turns only)")
  .option("--stdin", "Read body from stdin")
  .option("--body <str>", "Turn body")
  .option(
    "--editor",
    "Compose reply in $EDITOR with last turn pre-quoted (human only; default when --as human has no body source)",
  )
  .action(cmdReply);

program
  .command("open <file>")
  .description("Open the thread file in $EDITOR.")
  .action(cmdOpen);

program
  .command("converge <file>")
  .description("Append an Outcome section and mark the thread converged.")
  .option("--stdin", "Read outcome from stdin")
  .option("--body <str>", "Outcome body")
  .action(cmdConverge);

program
  .command("list")
  .description("List threads in .lazyai/, most recent first.")
  .option("--status <filter>", "Filter: open, converged, or all", "open")
  .option("--json", "Output as JSON array")
  .action(cmdList);

program
  .command("show <file>")
  .description("Print thread content. No flag prints the whole file.")
  .option("--turn <n>", "Print the turn with id N")
  .option("--last [n]", "Print the last N turns (default 1)")
  .action(cmdShow);

program
  .command("status <file>")
  .description("Print frontmatter, turn count, and last-updated timestamp.")
  .option("--json", "Output as JSON object")
  .action(cmdStatus);

program
  .command("onboard")
  .description("Print protocol reference and active threads.")
  .action(cmdOnboard);

program
  .command("skill")
  .description("Print the bundled SKILL-CLI.md content.")
  .action(cmdSkill);

program.exitOverride();

try {
  await program.parseAsync(process.argv);
} catch (err) {
  if (err instanceof CommanderError) {
    process.exit(err.exitCode === 0 ? 0 : 2);
  }
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}
