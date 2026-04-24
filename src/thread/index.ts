import { randomBytes } from "node:crypto";
import {
  mkdir,
  readdir,
  rename,
  stat,
  unlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";

export type Role = "agent" | "human";
export type Status = "open" | "converged";

export interface Turn {
  round: number;
  role: Role;
  model: string;
  body: string;
  raw: string;
}

export interface Thread {
  path: string;
  frontmatterRaw: string;
  status: Status;
  topic: string;
  turns: Turn[];
  hasOutcome: boolean;
  updatedAt: Date;
}

export interface Summary {
  path: string;
  status: Status;
  topic: string;
  rounds: number;
  updatedAt: Date;
}

export type ListFilter = "open" | "converged" | "all";

// ---------------------------------------------------------------------------
// Pure core — no filesystem I/O
// ---------------------------------------------------------------------------

export function slugifyTopic(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function timestampedPath(dir: string, slug: string, now: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const ts = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}T${p(now.getHours())}${p(now.getMinutes())}`;
  return join(dir, `${ts}-${slug}.md`);
}

export function nextRound(turns: Turn[], role: Role): number {
  if (turns.length === 0) return 1;
  const maxN = Math.max(...turns.map((t) => t.round));
  if (role === "agent") return maxN + 1;
  const humanAtMax = turns.some((t) => t.round === maxN && t.role === "human");
  return humanAtMax ? maxN + 1 : maxN;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const STATUS_RE = /^status:\s*(open|converged)\s*(\r?\n|$)/m;
const H1_RE = /^# (.+)$/m;
// em-dash is U+2014; tolerates annotations like (human, via chat)
const TURN_HEADER_RE =
  /^##\s+Round\s+(\d+)\s+\((agent|human)(?:,[^)]*)?\)(?:\s*—\s*@(\S+))?\s*$/;
const OUTCOME_RE = /^##\s+Outcome\s*$/m;

export function parseBytes(path: string, data: string): Thread {
  const text = data.replace(/\r\n/g, "\n");

  const fmMatch = text.match(FRONTMATTER_RE);
  if (!fmMatch) throw new Error(`${path}: missing frontmatter`);
  const frontmatterRaw = fmMatch[1];

  const statusMatch = frontmatterRaw.match(STATUS_RE);
  if (!statusMatch)
    throw new Error(`${path}: frontmatter missing valid status`);
  const status = statusMatch[1] as Status;

  const h1Match = text.match(H1_RE);
  const topic = h1Match ? h1Match[1].trim() : "";

  const hasOutcome = OUTCOME_RE.test(text);

  const turns: Turn[] = [];
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(TURN_HEADER_RE);
    if (!m) continue;

    const round = parseInt(m[1], 10);
    const role = m[2] as Role;
    const model = m[3] ?? "";
    const headerLine = lines[i];

    const bodyStart = i + 1;
    let bodyEnd = bodyStart;
    while (
      bodyEnd < lines.length &&
      lines[bodyEnd] !== "---" &&
      !lines[bodyEnd].match(TURN_HEADER_RE)
    ) {
      bodyEnd++;
    }

    const bodyLines = lines.slice(bodyStart, bodyEnd);
    const body = bodyLines.join("\n").trim();
    const raw = [headerLine, ...bodyLines].join("\n");

    turns.push({ round, role, model, body, raw });
  }

  return {
    path,
    frontmatterRaw,
    status,
    topic,
    turns,
    hasOutcome,
    updatedAt: new Date(0),
  };
}

// ---------------------------------------------------------------------------
// I/O layer
// ---------------------------------------------------------------------------

async function atomicWrite(path: string, content: string): Promise<void> {
  const dir = dirname(path);
  const tmp = join(dir, `.tmp-${randomBytes(6).toString("hex")}`);
  try {
    await writeFile(tmp, content, "utf8");
    await rename(tmp, path);
  } catch (e) {
    try {
      await unlink(tmp);
    } catch {
      // ignore cleanup failure
    }
    throw e;
  }
}

export async function parse(path: string): Promise<Thread> {
  const data = await Bun.file(path).text();
  const { mtime } = await stat(path);
  const thread = parseBytes(path, data);
  thread.updatedAt = mtime;
  return thread;
}

export async function newThread(
  path: string,
  topic: string,
  context: string,
): Promise<void> {
  try {
    await stat(path);
    throw new Error(`${path}: file already exists`);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }

  await mkdir(dirname(path), { recursive: true });

  const content = `---\nstatus: open\n---\n\n# ${topic}\n\n<!-- ${context} -->\n`;
  await atomicWrite(path, content);
}

export async function appendTurn(
  path: string,
  role: Role,
  model: string,
  body: string,
): Promise<number> {
  const data = await Bun.file(path).text();
  const thread = parseBytes(path, data);

  if (thread.status === "converged") {
    throw new Error(`${path}: thread is converged; cannot append turn`);
  }

  const round = nextRound(thread.turns, role);
  const effectiveModel = role === "agent" ? model || "unknown" : "";
  const attr = effectiveModel ? ` — @${effectiveModel}` : "";
  const header = `## Round ${round} (${role})${attr}`;

  const newContent =
    data.trimEnd() + `\n\n---\n\n${header}\n\n${body.trimEnd()}\n`;
  await atomicWrite(path, newContent);
  return round;
}

export async function converge(path: string, body: string): Promise<void> {
  const data = await Bun.file(path).text();
  const thread = parseBytes(path, data);

  if (thread.status === "converged") {
    throw new Error(`${path}: thread is already converged`);
  }

  let newContent =
    data.trimEnd() + `\n\n---\n\n## Outcome\n\n${body.trimEnd()}\n`;
  newContent = newContent.replace(/^status: open\s*$/m, "status: converged");

  await atomicWrite(path, newContent);
}

export async function listThreads(
  dir: string,
  filter: ListFilter = "open",
): Promise<Summary[]> {
  try {
    await stat(dir);
  } catch {
    return [];
  }

  const entries = await readdir(dir);
  const summaries: Summary[] = [];

  for (const entry of entries) {
    if (!entry.endsWith(".md")) continue;
    const filePath = join(dir, entry);
    try {
      const data = await Bun.file(filePath).text();
      const { mtime } = await stat(filePath);
      const thread = parseBytes(filePath, data);

      if (filter !== "all" && thread.status !== filter) continue;

      const rounds =
        thread.turns.length === 0
          ? 0
          : Math.max(...thread.turns.map((t) => t.round));

      summaries.push({
        path: filePath,
        status: thread.status,
        topic: thread.topic,
        rounds,
        updatedAt: mtime,
      });
    } catch {
      // skip malformed files silently
    }
  }

  return summaries.sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  );
}
