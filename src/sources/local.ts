import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { LocalSource } from "../config.js";
import { runStreaming, hasBin } from "../proc.js";
import { log } from "../log.js";
import type { SyncResult } from "./types.js";

export async function syncLocal(
  source: LocalSource,
  destBase: string,
): Promise<SyncResult> {
  const dest = join(destBase, source.name);
  await mkdir(dest, { recursive: true });

  if (!existsSync(source.path)) {
    log.warn(`[${source.name}] path does not exist: ${source.path}`);
    return { source: source.name, ok: false, reason: "path-missing" };
  }

  const rsyncAvailable = await hasBin("rsync");
  if (rsyncAvailable) {
    const code = await runStreaming("rsync", [
      "-a",
      "--delete",
      "--include=*/",
      "--include=*.jsonl",
      "--include=*.json",
      "--exclude=*",
      `${trailingSlash(source.path)}`,
      `${trailingSlash(dest)}`,
    ]);
    if (code !== 0) return { source: source.name, ok: false, reason: `rsync exit ${code}` };
  } else {
    // Fallback: cp -R (we only want jsonl/json, but cp doesn't filter — use find pipeline)
    const cmd = `find ${shellQuote(source.path)} -type f \\( -name '*.jsonl' -o -name '*.json' \\) -print0 | ` +
      `xargs -0 -I{} sh -c 'rel=\"\${1#${shellQuote(source.path)}/}\"; mkdir -p ${shellQuote(dest)}/\"$(dirname \"$rel\")\"; cp \"$1\" ${shellQuote(dest)}/\"$rel\"' _ {}`;
    const code = await runStreaming("sh", ["-c", cmd]);
    if (code !== 0) return { source: source.name, ok: false, reason: `copy exit ${code}` };
  }

  return { source: source.name, ok: true, dest };
}

function trailingSlash(p: string): string {
  return p.endsWith("/") ? p : `${p}/`;
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}
