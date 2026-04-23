#!/usr/bin/env bun

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

async function dispatch(cmd: Command, _args: string[]): Promise<number> {
  switch (cmd) {
    case "new":
    case "reply":
    case "converge":
    case "list":
    case "show":
    case "status":
    case "onboard":
      throw new Error(`not implemented: ${cmd}`);
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
