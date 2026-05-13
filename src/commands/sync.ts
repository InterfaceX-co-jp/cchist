import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "../config.js";
import { syncLocal } from "../sources/local.js";
import { syncSsh } from "../sources/ssh.js";
import { syncZip } from "../sources/zip.js";
import type { SyncResult } from "../sources/types.js";
import { ensureClaudeAvailable, runClaude, buildAnalyzePrompt } from "../claude.js";
import { log, color } from "../log.js";

export async function runSync(opts: {
  config?: string;
  analyze?: boolean;
  only?: string[];
  dryRun?: boolean;
}): Promise<number> {
  const config = await loadConfig(opts.config);
  await mkdir(config.storage, { recursive: true });

  const filter = opts.only && opts.only.length ? new Set(opts.only) : null;
  const targetSources = config.sources.filter((s) => !filter || filter.has(s.name));

  if (targetSources.length === 0) {
    log.warn("no sources matched");
    return 0;
  }

  log.header(`Syncing ${targetSources.length} source(s) → ${config.storage}`);

  const results: SyncResult[] = [];
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

  // Write a manifest summarizing this sync
  if (!opts.dryRun) {
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

  const successCount = results.filter((r) => r.ok).length;
  log.header(`${color.bold}Summary${color.reset}: ${successCount}/${results.length} sources synced`);

  if (opts.analyze) {
    const bin = config.claude_bin ?? "claude";
    if (!(await ensureClaudeAvailable(bin))) {
      log.error(`\`${bin}\` not found in PATH. Skipping --analyze.`);
      return successCount === results.length ? 0 : 1;
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

  return successCount === results.length ? 0 : 1;
}
