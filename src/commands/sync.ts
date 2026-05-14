import { mkdir, writeFile } from "node:fs/promises";
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

export async function runSync(opts: {
  config?: string;
  analyze?: boolean;
  only?: string[];
  onlyRemote?: string[];
  skipRemote?: boolean;
  remoteOnly?: boolean;
  dryRun?: boolean;
}): Promise<number> {
  const config = await loadConfig(opts.config);
  await mkdir(config.storage, { recursive: true });

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
