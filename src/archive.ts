import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";

export type SessionRecord = {
  source: string;
  path: string;
  size: number;
  mtime: Date;
  firstUserMessage?: string;
  messageCount?: number;
  projectHint?: string;
};

export async function walkJsonl(root: string): Promise<string[]> {
  const out: string[] = [];
  if (!existsSync(root)) return out;
  const stack: string[] = [root];
  while (stack.length) {
    const dir = stack.pop()!;
    const entries = await readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        stack.push(p);
      } else if (e.isFile() && (p.endsWith(".jsonl") || p.endsWith(".json"))) {
        if (e.name === ".cchist-manifest.json") continue;
        out.push(p);
      }
    }
  }
  return out;
}

export async function describeSession(filePath: string, archiveRoot: string): Promise<SessionRecord> {
  const st = await stat(filePath);
  const rel = relative(archiveRoot, filePath);
  const sourceName = rel.split("/")[0] ?? "unknown";
  const projectHint = rel.split("/").slice(1, -1).join("/") || undefined;

  let firstUserMessage: string | undefined;
  let messageCount = 0;

  // Stream the first ~512KB; large transcripts don't need full parse for metadata.
  try {
    const raw = await readFile(filePath, "utf8");
    const lines = raw.split("\n").filter(Boolean);
    messageCount = lines.length;
    for (const line of lines) {
      const obj = safeJson(line);
      if (!obj) continue;
      const role = pickRole(obj);
      const text = pickText(obj);
      if (role === "user" && text && !firstUserMessage) {
        firstUserMessage = text.slice(0, 200);
        break;
      }
    }
  } catch {
    // ignore, leave fields undefined
  }

  return {
    source: sourceName,
    path: filePath,
    size: st.size,
    mtime: st.mtime,
    firstUserMessage,
    messageCount,
    projectHint,
  };
}

function safeJson(s: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(s);
    return typeof v === "object" && v ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function pickRole(obj: Record<string, unknown>): string | undefined {
  // Claude Code jsonl uses { type: "user" | "assistant", ... } at top level
  // Or { message: { role: "user", ... } } in some variants
  if (typeof obj.type === "string" && (obj.type === "user" || obj.type === "assistant")) {
    return obj.type;
  }
  const msg = obj.message as Record<string, unknown> | undefined;
  if (msg && typeof msg.role === "string") return msg.role;
  if (typeof obj.sender === "string") return obj.sender;
  return undefined;
}

function pickText(obj: Record<string, unknown>): string | undefined {
  // Claude Code: obj.message.content can be string or array of blocks
  const msg = obj.message as Record<string, unknown> | undefined;
  const content = (msg?.content ?? obj.content ?? obj.text) as unknown;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const texts = content
      .map((b: any) => (typeof b === "string" ? b : typeof b?.text === "string" ? b.text : ""))
      .filter(Boolean);
    if (texts.length) return texts.join(" ");
  }
  return undefined;
}

export async function grepArchive(root: string, query: string): Promise<Array<{ path: string; line: number; preview: string }>> {
  const results: Array<{ path: string; line: number; preview: string }> = [];
  const files = await walkJsonl(root);
  const needle = query.toLowerCase();
  for (const file of files) {
    let raw: string;
    try {
      raw = await readFile(file, "utf8");
    } catch {
      continue;
    }
    const lines = raw.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(needle)) {
        const obj = safeJson(lines[i]);
        const preview = obj ? (pickText(obj)?.slice(0, 200) ?? lines[i].slice(0, 200)) : lines[i].slice(0, 200);
        results.push({ path: file, line: i + 1, preview });
      }
    }
  }
  return results;
}
