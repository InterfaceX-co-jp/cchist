import { loadConfig } from "../config.js";
import { walkJsonl, describeSession } from "../archive.js";
import { log, color } from "../log.js";

export async function runList(opts: {
  config?: string;
  source?: string;
  limit?: number;
  json?: boolean;
}): Promise<number> {
  const config = await loadConfig(opts.config);
  const files = await walkJsonl(config.storage);
  const records = [];
  for (const file of files) {
    if (opts.source && !file.includes(`/${opts.source}/`)) continue;
    records.push(await describeSession(file, config.storage));
  }
  records.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  const sliced = opts.limit ? records.slice(0, opts.limit) : records;

  if (opts.json) {
    console.log(JSON.stringify(sliced, null, 2));
    return 0;
  }

  if (sliced.length === 0) {
    log.warn("no sessions found in archive. Run `cchist sync` first.");
    return 0;
  }

  for (const r of sliced) {
    const date = r.mtime.toISOString().slice(0, 16).replace("T", " ");
    const sizeKb = (r.size / 1024).toFixed(1);
    const messages = r.messageCount ?? 0;
    const preview = r.firstUserMessage?.replace(/\s+/g, " ") ?? "(no user message)";
    const project = r.projectHint ? `${color.dim}${r.projectHint}${color.reset} ` : "";
    console.log(
      `${color.cyan}${date}${color.reset}  ${color.bold}${r.source}${color.reset}  ${project}${color.dim}${sizeKb}KB · ${messages}msg${color.reset}`,
    );
    console.log(`  ${preview.slice(0, 100)}${preview.length > 100 ? "…" : ""}`);
    console.log(`  ${color.dim}${r.path}${color.reset}`);
  }
  log.dim(`\n${sliced.length} session(s)${opts.limit && records.length > opts.limit ? ` (of ${records.length} total)` : ""}`);
  return 0;
}
