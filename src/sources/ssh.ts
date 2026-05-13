import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { SshSource } from "../config.js";
import { runStreaming, hasBin } from "../proc.js";
import { log } from "../log.js";
import type { SyncResult } from "./types.js";

export async function syncSsh(
  source: SshSource,
  destBase: string,
): Promise<SyncResult> {
  const dest = join(destBase, source.name);
  await mkdir(dest, { recursive: true });

  if (!(await hasBin("rsync"))) {
    log.error(`[${source.name}] rsync is required for ssh sources; install it locally and on the remote.`);
    return { source: source.name, ok: false, reason: "rsync-missing" };
  }

  const target = source.user
    ? `${source.user}@${source.host}:${source.remote_path}/`
    : `${source.host}:${source.remote_path}/`;

  const args = [
    "-az",
    "--delete",
    "--include=*/",
    "--include=*.jsonl",
    "--include=*.json",
    "--exclude=*",
    "-e",
    "ssh -o BatchMode=yes -o ConnectTimeout=15",
    ...(source.rsync_args ?? []),
    target,
    `${dest}/`,
  ];

  log.dim(`[${source.name}] rsync ${args.slice(-2).join(" ")}`);
  const code = await runStreaming("rsync", args);
  if (code !== 0) {
    return { source: source.name, ok: false, reason: `rsync exit ${code}` };
  }
  return { source: source.name, ok: true, dest };
}
