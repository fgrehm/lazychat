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

export function parseBytes(_path: string, _data: string): Thread {
  throw new Error("not implemented");
}

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

export function nextRound(_turns: Turn[], _role: Role): number {
  throw new Error("not implemented");
}

export function slugifyTopic(_s: string): string {
  throw new Error("not implemented");
}

export function timestampedPath(
  _dir: string,
  _slug: string,
  _now: Date,
): string {
  throw new Error("not implemented");
}
