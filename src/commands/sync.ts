import { mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../config.js";
import { syncLocal } from "../sources/local.js";
import { syncSsh } from "../sources/ssh.js";
import { syncZip } from "../sources/zip.js";
import type { SyncResult } from "../sources/types.js";
import { pushS3 } from "../remotes/s3.js";
import type { PushResult } from "../remotes/types.js";
import { ensureClaudeAvailable, runClaude, buildAnalyzePrompt } from "../claude.js";
import { log, color } from "../log.js";

const DEBOUNCE_FILE = ".cchist-last-sync";

/**
 * Returns true if enough time has passed since the last sync (i.e. we should
 * proceed), or false if we are still within the debounce window.
 */
async function shouldRunDebounced(storage: string, debounceSeconds: number): Promise<boolean> {
  const stampPath = join(storage, DEBOUNCE_FILE);
  if (!existsSync(stampPath)) return true;
  try {
    const raw = await readFile(stampPath, "utf8");
    const lastMs = parseInt(raw.trim(), 10);
    if (isNaN(lastMs)) return true;
    return Date.now() - lastMs >= debounceSeconds * 1000;
  } catch {
    // Unreadable stamp → treat as stale, proceed with sync
    return true;
  }
}

async function recordSyncTime(storage: string): Promise<void> {
  await writeFile(join(storage, DEBOUNCE_FILE), String(Date.now()), "utf8");
}

export async function runSync(opts: {
  config?: string;
  analyze?: boolean;
  only?: string[];
  onlyRemote?: string[];
  skipRemote?: boolean;
  remoteOnly?: boolean;
  dryRun?: boolean;
  /** Skip sync if it already ran within this many seconds (0 = disabled) */
  debounce?: number;
}): Promise<number> {
  const config = await loadConfig(opts.config);
  await mkdir(config.storage, { recursive: true });

  // Debounce: skip if we already synced within the requested window
  if (opts.debounce && opts.debounce > 0 && !opts.dryRun) {
    const proceed = await shouldRunDebounced(config.storage, opts.debounce);
    if (!proceed) {
      log.dim(`[debounce] last sync was within ${opts.debounce}s — skipping`);
      return 0;
    }
  }

  const filter = opts.only && opts.only.length ? new Set(opts.only) : null;
  const targetSources = config.sources.filter((s) => !filter || filter.has(s.name));

  const remoteFilter = opts.onlyRemote && opts.onlyRemote.length ? new Set(opts.onlyRemote) : null;
  const targetRemotes = opts.skipRemote
    ? []
    : config.remotes.filter((r) => !remoteFilter || remoteFilter.has(r.name));

  const results: SyncResult[] = [];

  if (!opts.remoteOnly) {
    if (targetSources.length === 0) {
      log.warn("no sources matched");
      // Fall through — user may still want remote push (e.g. re-push existing archive)
    } else {
      log.header(`Syncing ${targetSources.length} source(s) → ${config.storage}`);

      for (const source of targetSources) {
        log.info(`[${source.name}] kind=${source.kind}`);
        if (opts.dryRun) {
          log.dim(`  (dry-run: skipped)`);
          continue;
        }
        let result: SyncResult;
        switch (source.kind) {
          case "local":
            result = await syncLocal(source, config.storage);
            break;
          case "ssh":
            result = await syncSsh(source, config.storage);
            break;
          case "zip":
            result = await syncZip(source, config.storage);
            break;
        }
        results.push(result);
        if (result.ok) {
          log.ok(`[${source.name}] done`);
        } else {
          log.error(`[${source.name}] failed: ${result.reason}`);
        }
      }
    }

    // Write a manifest summarizing this sync
    if (!opts.dryRun && results.length > 0) {
      const manifest = {
        synced_at: new Date().toISOString(),
        storage: config.storage,
        results,
      };
      await writeFile(
        join(config.storage, ".cchist-manifest.json"),
        JSON.stringify(manifest, null, 2),
      );
    }
  }

  const successCount = results.filter((r) => r.ok).length;
  if (results.length > 0) {
    log.header(`${color.bold}Summary${color.reset}: ${successCount}/${results.length} sources synced`);
  }

  // Record sync timestamp for debounce (even on partial success, to avoid retry storms)
  if (!opts.dryRun && opts.debounce && opts.debounce > 0) {
    await recordSyncTime(config.storage);
  }

  // Remote push (S3 / R2 / S3-compatible)
  const pushResults: PushResult[] = [];
  if (targetRemotes.length > 0) {
    log.header(`Pushing archive → ${targetRemotes.length} remote(s)`);
    for (const remote of targetRemotes) {
      log.info(`[${remote.name}] kind=${remote.kind} bucket=${remote.bucket}`);
      const r = await pushS3(remote, config.storage, { dryRun: opts.dryRun });
      pushResults.push(r);
      if (r.ok) log.ok(`[${remote.name}] pushed → ${r.uri}`);
      else log.error(`[${remote.name}] failed: ${r.reason}`);
    }
    const pushOk = pushResults.filter((r) => r.ok).length;
    log.header(`${color.bold}Remote${color.reset}: ${pushOk}/${pushResults.length} pushed`);
  }

  if (opts.analyze) {
    const bin = config.claude_bin ?? "claude";
    if (!(await ensureClaudeAvailable(bin))) {
      log.error(`\`${bin}\` not found in PATH. Skipping --analyze.`);
      const sOk = results.length === 0 || successCount === results.length;
      const rOk = pushResults.every((r) => r.ok);
      return sOk && rOk ? 0 : 1;
    }
    log.header("Analyzing archive with claude -p ...");
    const code = await runClaude({
      bin,
      cwd: config.storage,
      prompt: buildAnalyzePrompt(config.storage),
    });
    if (code !== 0) {
      log.warn(`claude exited with code ${code}`);
    }
  }

  const sourcesOk = results.length === 0 || successCount === results.length;
  const remotesOk = pushResults.every((r) => r.ok);
  return sourcesOk && remotesOk ? 0 : 1;
}
