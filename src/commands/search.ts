import { loadConfig } from "../config.js";
import { grepArchive } from "../archive.js";
import { log, color } from "../log.js";

export async function runSearch(opts: {
  config?: string;
  query: string;
  limit?: number;
}): Promise<number> {
  const config = await loadConfig(opts.config);
  const results = await grepArchive(config.storage, opts.query);
  if (results.length === 0) {
    log.warn(`no matches for "${opts.query}"`);
    return 1;
  }
  const sliced = opts.limit ? results.slice(0, opts.limit) : results;
  for (const r of sliced) {
    console.log(`${color.cyan}${r.path}:${r.line}${color.reset}`);
    console.log(`  ${r.preview}`);
  }
  log.dim(`\n${sliced.length} match(es)${opts.limit && results.length > opts.limit ? ` (of ${results.length} total)` : ""}`);
  return 0;
}
