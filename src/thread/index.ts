import { randomBytes } from "node:crypto";
import {
  mkdir,
  readdir,
  rename,
  stat,
  unlink,
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

// Pure core

export function maxRound(turns: Turn[]): number {
  let max = 0;
  for (const t of turns) if (t.round > max) max = t.round;
  return max;
}

export function slugifyTopic(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function timestampedPath(dir: string, slug: string, now: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const ts = `${now.getUTCFullYear()}-${p(now.getUTCMonth() + 1)}-${p(now.getUTCDate())}T${p(now.getUTCHours())}${p(now.getUTCMinutes())}`;
  return join(dir, `${ts}-${slug}.md`);
}

export function nextRound(turns: Turn[], role: Role): number {
  if (turns.length === 0) return 1;
  const max = maxRound(turns);
  if (role === "agent") return max + 1;
  const humanAtMax = turns.some((t) => t.round === max && t.role === "human");
  return humanAtMax ? max + 1 : max;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const STATUS_RE = /^status:\s*(open|converged)\s*(\r?\n|$)/m;
const H1_RE = /^# (.+)$/m;
// Attribution separator is a plain hyphen on write. Parse also accepts
// en-dash (U+2013) and em-dash (U+2014) so older threads and hand-typed
// turns still parse cleanly. Tolerates annotations like (human, via chat).
const TURN_HEADER_RE =
  /^##\s+Round\s+(\d+)\s+\((agent|human)(?:,[^)]*)?\)(?:\s*[-–—]\s*@(\S+))?\s*$/;
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
  if (!h1Match) throw new Error(`${path}: missing topic heading`);
  const topic = h1Match[1].trim();
  if (!topic) throw new Error(`${path}: topic heading must not be empty`);

  const turns: Turn[] = [];
  const lines = text.split("\n");

  // A `---` line is a turn separator only when the next non-blank line is
  // another turn header or an Outcome heading. Otherwise it's a legitimate
  // markdown horizontal rule inside the turn body and must be preserved.
  const isTurnSeparator = (idx: number): boolean => {
    if (lines[idx] !== "---") return false;
    let j = idx + 1;
    while (j < lines.length && lines[j] === "") j++;
    if (j >= lines.length) return false;
    return TURN_HEADER_RE.test(lines[j]) || OUTCOME_RE.test(lines[j]);
  };

  // hasOutcome means a real Outcome section exists, i.e. an Outcome heading
  // that sits at a section boundary (preceded by `---`, like converge() writes).
  // Matching OUTCOME_RE against the whole file would also fire on a turn body
  // that quotes the literal heading, which is not an Outcome section.
  let hasOutcome = false;
  for (let i = 0; i < lines.length; i++) {
    if (isTurnSeparator(i)) {
      let j = i + 1;
      while (j < lines.length && lines[j] === "") j++;
      if (j < lines.length && OUTCOME_RE.test(lines[j])) {
        hasOutcome = true;
        break;
      }
    }
  }

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
      !lines[bodyEnd].match(TURN_HEADER_RE) &&
      !isTurnSeparator(bodyEnd)
    ) {
      bodyEnd++;
    }

    const bodyLines = lines.slice(bodyStart, bodyEnd);
    let bs = 0;
    let be = bodyLines.length;
    while (bs < be && bodyLines[bs] === "") bs++;
    while (be > bs && bodyLines[be - 1] === "") be--;
    turns.push({
      round,
      role,
      model,
      body: bodyLines.slice(bs, be).join("\n"),
      raw: [headerLine, ...bodyLines].join("\n"),
    });
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

// I/O layer

async function atomicWrite(path: string, content: string): Promise<void> {
  const tmp = join(dirname(path), `.tmp-${randomBytes(6).toString("hex")}`);
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
  const [data, { mtime }] = await Promise.all([
    Bun.file(path).text(),
    stat(path),
  ]);
  const thread = parseBytes(path, data);
  thread.updatedAt = mtime;
  return thread;
}

export async function newThread(
  path: string,
  topic: string,
  context: string,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const comment = context.includes("\n")
    ? `<!--\n${context}\n-->`
    : `<!-- ${context} -->`;
  const content = `---\nstatus: open\n---\n\n# ${topic}\n\n${comment}\n`;
  try {
    await writeFile(path, content, { encoding: "utf8", flag: "wx" });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(`${path}: file already exists`);
    }
    throw e;
  }
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
  const attr = effectiveModel ? ` - @${effectiveModel}` : "";
  const header = `## Round ${round} (${role})${attr}`;

  await atomicWrite(
    path,
    data.replace(/\n+$/, "") + `\n\n---\n\n${header}\n\n${body.trimEnd()}\n`,
  );
  return round;
}

export async function converge(path: string, body: string): Promise<void> {
  const data = await Bun.file(path).text();
  const thread = parseBytes(path, data);

  if (thread.status === "converged") {
    throw new Error(`${path}: thread is already converged`);
  }

  // Flip status only within the frontmatter block. A naive file-wide replace
  // would rewrite a literal `status: open` line that happens to appear inside
  // a turn body, violating the append-only invariant.
  const withOutcome =
    data.replace(/\n+$/, "") + `\n\n---\n\n## Outcome\n\n${body.trimEnd()}\n`;
  // The flip pattern mirrors STATUS_RE's whitespace tolerance so a hand-edited
  // `status:open` (or `status:  open`) still gets converged.
  const newContent = withOutcome.replace(FRONTMATTER_RE, (match, fm: string) =>
    match.replace(fm, fm.replace(/^status:\s*open\s*$/m, "status: converged")),
  );
  await atomicWrite(path, newContent);
}

export async function listThreads(
  dir: string,
  filter: ListFilter = "open",
): Promise<Summary[]> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }

  const results = await Promise.all(
    entries
      .filter((e) => e.endsWith(".md"))
      .map(async (entry): Promise<Summary | null> => {
        const filePath = join(dir, entry);
        try {
          const [data, { mtime }] = await Promise.all([
            Bun.file(filePath).text(),
            stat(filePath),
          ]);
          const thread = parseBytes(filePath, data);
          if (filter !== "all" && thread.status !== filter) return null;
          return {
            path: filePath,
            status: thread.status,
            topic: thread.topic,
            rounds: maxRound(thread.turns),
            updatedAt: mtime,
          };
        } catch {
          return null;
        }
      }),
  );

  return results
    .filter((s): s is Summary => s !== null)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}
