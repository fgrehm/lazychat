#!/usr/bin/env bun

import { parseArgs } from "node:util";
import type { ListFilter } from "../thread/index.ts";
import {
  appendTurn,
  converge,
  listThreads,
  newThread,
  parse,
  slugifyTopic,
  timestampedPath,
} from "../thread/index.ts";

const LAZYAI_DIR = ".lazyai";

const DEFAULT_CONTEXT =
  "One paragraph: what we are figuring out, why it matters, and what the target artifact is.";

const ONBOARD_BLOCK = `\
lazychat — file-based async discussion protocol

Commands:
  new <topic-slug> [--context -]
      Create a new thread. Prints the file path on stdout.
      --context - reads one paragraph of context from stdin.

  reply <file> --as <agent|human> [--model <id>] [--stdin | --body <str>]
      Append a turn. --as is required. Exactly one of --stdin or --body must be given.
      --model is only meaningful for agent turns (default: unknown).

  converge <file> [--stdin | --body <str>]
      Append an Outcome section and mark the thread converged.

  list [--status open|converged|all]
      List threads in .lazyai/, most recent first. Default: open.

  show <file> [--round N | --last | --since N]
      Print thread content. No flag prints the whole file.
      --round N   print all turns at round N.
      --last      print the last turn.
      --since N   print turns where round > N.

  status <file>
      Print frontmatter, round count, and last-updated timestamp.

  onboard
      Print this block and active threads.

Protocol rules:
  - Threads are append-only. Never edit prior turns.
  - Agent turns carry model attribution after an em-dash (— @model-id).
  - Converged threads are read-only.
  - Thread files live in .lazyai/ in the current working tree.`;

const COMMANDS = [
  "new",
  "reply",
  "converge",
  "list",
  "show",
  "status",
  "onboard",
] as const;
type Command = (typeof COMMANDS)[number];

function isCommand(s: string): s is Command {
  return (COMMANDS as readonly string[]).includes(s);
}

function usage(): string {
  return [
    "usage: lazychat <command> [args]",
    "",
    "commands:",
    "  new <topic-slug> [--context -]",
    "  reply <file> --as <agent|human> [--model <id>] [--stdin | --body <str>]",
    "  converge <file> [--stdin | --body <str>]",
    "  list [--status open|converged|all]",
    "  show <file> [--round N | --last | --since N]",
    "  status <file>",
    "  onboard",
  ].join("\n");
}

async function readStdin(): Promise<string> {
  return (await Bun.stdin.text()).trimEnd();
}

function padTable(rows: string[][]): string {
  if (rows.length === 0) return "";
  const cols = rows[0].length;
  const widths = Array.from({ length: cols - 1 }, (_, i) =>
    Math.max(...rows.map((r) => r[i]?.length ?? 0)),
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
  const base = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  return seconds ? `${base}:${p(d.getSeconds())}` : base;
}

// Commands

async function cmdNew(args: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    options: { context: { type: "string" } },
    allowPositionals: true,
    strict: true,
  });

  const rawSlug = positionals[0];
  if (!rawSlug) {
    process.stderr.write("error: missing <topic-slug>\n");
    return 2;
  }

  if (values.context !== undefined && values.context !== "-") {
    process.stderr.write(
      "error: --context only accepts '-' (read from stdin)\n",
    );
    return 2;
  }

  const context = values.context === "-" ? await readStdin() : DEFAULT_CONTEXT;
  const slug = slugifyTopic(rawSlug);
  const path = timestampedPath(LAZYAI_DIR, slug, new Date());

  await newThread(path, slug, context);
  process.stdout.write(path + "\n");
  return 0;
}

async function cmdReply(args: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      as: { type: "string" },
      model: { type: "string" },
      stdin: { type: "boolean" },
      body: { type: "string" },
    },
    allowPositionals: true,
    strict: true,
  });

  const file = positionals[0];
  if (!file) {
    process.stderr.write("error: missing <file>\n");
    return 2;
  }

  const role = values.as;
  if (!role || (role !== "agent" && role !== "human")) {
    process.stderr.write("error: --as <agent|human> is required\n");
    return 2;
  }

  if (values.stdin && values.body !== undefined) {
    process.stderr.write("error: --stdin and --body are mutually exclusive\n");
    return 2;
  }
  if (!values.stdin && values.body === undefined) {
    process.stderr.write("error: --stdin or --body must be provided\n");
    return 2;
  }

  const body = values.stdin ? await readStdin() : values.body!;
  const round = await appendTurn(file, role, values.model ?? "", body);
  process.stdout.write(`appended round ${round} (${role}) to ${file}\n`);
  return 0;
}

async function cmdConverge(args: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      stdin: { type: "boolean" },
      body: { type: "string" },
    },
    allowPositionals: true,
    strict: true,
  });

  const file = positionals[0];
  if (!file) {
    process.stderr.write("error: missing <file>\n");
    return 2;
  }

  if (values.stdin && values.body !== undefined) {
    process.stderr.write("error: --stdin and --body are mutually exclusive\n");
    return 2;
  }
  if (!values.stdin && values.body === undefined) {
    process.stderr.write("error: --stdin or --body must be provided\n");
    return 2;
  }

  const body = values.stdin ? await readStdin() : values.body!;
  await converge(file, body);
  return 0;
}

async function cmdList(args: string[]): Promise<number> {
  const { values } = parseArgs({
    args,
    options: { status: { type: "string" } },
    strict: true,
  });

  const filter = (values.status ?? "open") as ListFilter;
  if (filter !== "open" && filter !== "converged" && filter !== "all") {
    process.stderr.write("error: --status must be open, converged, or all\n");
    return 2;
  }

  const summaries = await listThreads(LAZYAI_DIR, filter);
  if (summaries.length === 0) return 0;

  process.stdout.write(
    padTable(
      summaries.map((s) => [
        s.status,
        s.path,
        `${s.rounds} rounds`,
        fmtDate(s.updatedAt),
        s.topic,
      ]),
    ) + "\n",
  );
  return 0;
}

async function cmdShow(args: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    options: {
      round: { type: "string" },
      last: { type: "boolean" },
      since: { type: "string" },
    },
    allowPositionals: true,
    strict: true,
  });

  const file = positionals[0];
  if (!file) {
    process.stderr.write("error: missing <file>\n");
    return 2;
  }

  const numSelectors = [
    values.round !== undefined,
    values.last === true,
    values.since !== undefined,
  ].filter(Boolean).length;

  if (numSelectors > 1) {
    process.stderr.write(
      "error: --round, --last, and --since are mutually exclusive\n",
    );
    return 2;
  }

  if (numSelectors === 0) {
    process.stdout.write(await Bun.file(file).text());
    return 0;
  }

  const thread = await parse(file);

  let selected;
  if (values.round !== undefined) {
    const n = parseInt(values.round, 10);
    selected = thread.turns.filter((t) => t.round === n);
  } else if (values.last) {
    const last = thread.turns.at(-1);
    selected = last ? [last] : [];
  } else {
    const n = parseInt(values.since!, 10);
    selected = thread.turns.filter((t) => t.round > n);
  }

  if (selected.length > 0) {
    process.stdout.write(
      selected.map((t) => t.raw.trimEnd()).join("\n\n---\n\n") + "\n",
    );
  }
  return 0;
}

async function cmdStatus(args: string[]): Promise<number> {
  const { positionals } = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
  });

  const file = positionals[0];
  if (!file) {
    process.stderr.write("error: missing <file>\n");
    return 2;
  }

  const thread = await parse(file);
  process.stdout.write(
    [
      thread.frontmatterRaw.trim(),
      `rounds: ${thread.turns.length}`,
      `updated: ${fmtDate(thread.updatedAt, true)}`,
    ].join("\n") + "\n",
  );
  return 0;
}

async function cmdOnboard(): Promise<number> {
  const summaries = await listThreads(LAZYAI_DIR, "open");
  const active = summaries.slice(0, 10);

  process.stdout.write(ONBOARD_BLOCK + "\n");
  process.stdout.write(
    "\n# Active threads in this working tree (most recent first):\n",
  );

  if (active.length === 0) {
    process.stdout.write(
      "# No active threads in .lazyai/ — use `lazychat new <topic-slug>` to start one.\n",
    );
  } else {
    for (const s of active) {
      process.stdout.write(
        `# ${fmtDate(s.updatedAt)}  ${s.path}  ${s.topic}\n`,
      );
    }
  }

  return 0;
}

async function dispatch(cmd: Command, args: string[]): Promise<number> {
  switch (cmd) {
    case "new":
      return cmdNew(args);
    case "reply":
      return cmdReply(args);
    case "converge":
      return cmdConverge(args);
    case "list":
      return cmdList(args);
    case "show":
      return cmdShow(args);
    case "status":
      return cmdStatus(args);
    case "onboard":
      return cmdOnboard();
  }
}

async function main(argv: string[]): Promise<number> {
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === "-h" || cmd === "--help") {
    process.stdout.write(usage() + "\n");
    return 0;
  }
  if (!isCommand(cmd)) {
    process.stderr.write(`unknown command: ${cmd}\n\n${usage()}\n`);
    return 2;
  }
  return dispatch(cmd, rest);
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(
      `${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  });
