import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import type { ZipSource } from "../config.js";
import { runStreaming, hasBin } from "../proc.js";
import { log } from "../log.js";
import type { SyncResult } from "./types.js";

/**
 * Claude.ai data exports ship as a zip containing `conversations.json` (and friends).
 * We extract, then split each conversation into its own jsonl-ish file so it lines
 * up with the directory shape Claude Code uses.
 *
 * The exact schema of conversations.json is documented at
 * https://support.claude.com/en/articles/9450526-how-can-i-export-my-claude-data
 * — we treat unknown fields as opaque and just write them through.
 */
export async function syncZip(
  source: ZipSource,
  destBase: string,
): Promise<SyncResult> {
  const dest = join(destBase, source.name);
  await mkdir(dest, { recursive: true });

  if (!existsSync(source.path)) {
    log.warn(`[${source.name}] zip does not exist: ${source.path}`);
    return { source: source.name, ok: false, reason: "path-missing" };
  }

  if (!(await hasBin("unzip"))) {
    log.error(`[${source.name}] 'unzip' is required for zip sources`);
    return { source: source.name, ok: false, reason: "unzip-missing" };
  }

  const tmp = await mkdtemp(join(tmpdir(), "cchist-zip-"));
  try {
    const code = await runStreaming("unzip", ["-q", "-o", source.path, "-d", tmp]);
    if (code !== 0) {
      return { source: source.name, ok: false, reason: `unzip exit ${code}` };
    }

    const convPath = join(tmp, "conversations.json");
    if (!existsSync(convPath)) {
      log.warn(`[${source.name}] conversations.json not found inside zip`);
      return { source: source.name, ok: false, reason: "no-conversations" };
    }

    const raw = await readFile(convPath, "utf8");
    let conversations: unknown;
    try {
      conversations = JSON.parse(raw);
    } catch (err) {
      return { source: source.name, ok: false, reason: `json parse: ${(err as Error).message}` };
    }
    if (!Array.isArray(conversations)) {
      return { source: source.name, ok: false, reason: "conversations.json is not an array" };
    }

    let written = 0;
    for (const conv of conversations as Array<Record<string, unknown>>) {
      const id = String(conv.uuid ?? conv.id ?? `unknown-${written}`);
      const outPath = join(dest, "claude-ai", `${id}.jsonl`);
      await mkdir(dirname(outPath), { recursive: true });

      // Each message becomes one line. Preserve conversation metadata as the first line.
      const lines: string[] = [];
      lines.push(JSON.stringify({ type: "conversation_meta", ...conv, chat_messages: undefined }));
      const messages = (conv.chat_messages ?? conv.messages ?? []) as Array<Record<string, unknown>>;
      for (const msg of messages) {
        lines.push(JSON.stringify({ type: "message", ...msg }));
      }
      await writeFile(outPath, lines.join("\n") + "\n");
      written++;
    }

    log.dim(`[${source.name}] extracted ${written} conversation(s)`);
    return { source: source.name, ok: true, dest };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
}
