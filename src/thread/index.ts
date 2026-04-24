import { join } from "node:path";

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
// I/O layer — implemented in step 2
// ---------------------------------------------------------------------------

export async function parse(_path: string): Promise<Thread> {
  throw new Error("not implemented");
}

export async function newThread(
  _path: string,
  _topic: string,
  _context: string,
): Promise<void> {
  throw new Error("not implemented");
}

export async function appendTurn(
  _path: string,
  _role: Role,
  _model: string,
  _body: string,
): Promise<number> {
  throw new Error("not implemented");
}

export async function converge(_path: string, _body: string): Promise<void> {
  throw new Error("not implemented");
}

export async function listThreads(
  _dir: string,
  _filter: ListFilter = "open",
): Promise<Summary[]> {
  throw new Error("not implemented");
}
