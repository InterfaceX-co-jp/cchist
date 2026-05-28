export type ClaudeRecord = {
  type?: string;
  uuid?: string;
  parentUuid?: string | null;
  sessionId?: string;
  timestamp?: string;
  cwd?: string;
  gitBranch?: string;
  message?: {
    role?: "user" | "assistant" | "system";
    content?: unknown;
  };
  [k: string]: unknown;
};

export function parseJsonl(text: string): ClaudeRecord[] {
  const out: ClaudeRecord[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed) as ClaudeRecord);
    } catch {
      // skip malformed line — don't throw whole session
    }
  }
  return out;
}

export type ChatTurn = {
  role: "user" | "assistant" | "system";
  timestamp: string | undefined;
  text: string;
};

export function extractTurns(records: ClaudeRecord[]): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (const r of records) {
    if (r.type !== "user" && r.type !== "assistant") continue;
    const role = r.message?.role;
    if (role !== "user" && role !== "assistant" && role !== "system") continue;
    const text = stringifyContent(r.message?.content);
    if (!text.trim()) continue;
    turns.push({ role, timestamp: r.timestamp, text });
  }
  return turns;
}

function stringifyContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;
    if (b.type === "text" && typeof b.text === "string") {
      parts.push(b.text);
    } else if (b.type === "tool_use") {
      const name = typeof b.name === "string" ? b.name : "tool";
      parts.push(`\n[tool_use: ${name}]`);
    } else if (b.type === "tool_result") {
      const result =
        typeof b.content === "string" ? b.content : JSON.stringify(b.content);
      parts.push(`\n[tool_result]\n${truncate(result, 2000)}`);
    }
  }
  return parts.join("\n");
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "… [truncated]" : s;
}

export function sessionMeta(records: ClaudeRecord[]): {
  sessionId: string | undefined;
  cwd: string | undefined;
  gitBranch: string | undefined;
  firstTs: string | undefined;
  lastTs: string | undefined;
  turnCount: number;
} {
  let sessionId: string | undefined;
  let cwd: string | undefined;
  let gitBranch: string | undefined;
  let firstTs: string | undefined;
  let lastTs: string | undefined;
  let turnCount = 0;

  for (const r of records) {
    sessionId ??= r.sessionId;
    cwd ??= r.cwd;
    gitBranch ??= r.gitBranch;
    if (r.timestamp) {
      firstTs ??= r.timestamp;
      lastTs = r.timestamp;
    }
    if (r.type === "user" || r.type === "assistant") turnCount++;
  }

  return { sessionId, cwd, gitBranch, firstTs, lastTs, turnCount };
}
