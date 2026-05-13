import { loadConfig } from "../config.js";
import { ensureClaudeAvailable, runClaude, buildAnalyzePrompt } from "../claude.js";
import { log } from "../log.js";

export async function runAnalyze(opts: {
  config?: string;
  prompt?: string;
}): Promise<number> {
  const config = await loadConfig(opts.config);
  const bin = config.claude_bin ?? "claude";
  if (!(await ensureClaudeAvailable(bin))) {
    log.error(`\`${bin}\` not found in PATH.`);
    return 1;
  }
  const prompt = opts.prompt ?? buildAnalyzePrompt(config.storage);
  return await runClaude({
    bin,
    cwd: config.storage,
    prompt,
  });
}
