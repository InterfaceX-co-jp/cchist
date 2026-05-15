import { Command } from "commander";
import { runInit } from "./commands/init.js";
import { runSync } from "./commands/sync.js";
import { runList } from "./commands/list.js";
import { runSearch } from "./commands/search.js";
import { runAnalyze } from "./commands/analyze.js";
import { runInstallHook } from "./commands/install-hook.js";
import { ConfigNotFoundError } from "./config.js";
import { log } from "./log.js";

const program = new Command();

program
  .name("cchist")
  .description("Aggregate Claude conversation history from all your machines")
  .version("0.1.0")
  .option("-c, --config <path>", "path to cchist config file");

program
  .command("init")
  .description("create a starter config file")
  .option("-p, --path <path>", "where to write config", "~/.config/cchist/config.toml")
  .option("-f, --force", "overwrite existing config")
  .action(async (opts) => {
    process.exit(await runInit(opts));
  });

program
  .command("sync")
  .description("pull conversation history from all configured sources")
  .option("--analyze", "after sync, spawn `claude -p` to summarize unfinished tasks")
  .option("--only <name...>", "sync only the named source(s)")
  .option("--only-remote <name...>", "push only to the named remote(s)")
  .option("--skip-remote", "skip pushing to configured [[remote]] targets")
  .option("--remote-only", "skip source sync; only push existing archive to remotes")
  .option("--dry-run", "don't actually transfer; just print what would happen")
  .option("--debounce <seconds>", "skip sync if it already ran within N seconds", (v) => parseInt(v, 10))
  .action(async (opts) => {
    process.exit(await runSync({ ...opts, config: program.opts().config }));
  });

program
  .command("list")
  .description("list sessions in the archive, most recent first")
  .option("-s, --source <name>", "filter by source name")
  .option("-n, --limit <count>", "max sessions to show", (v) => parseInt(v, 10))
  .option("--json", "output JSON")
  .action(async (opts) => {
    process.exit(await runList({ ...opts, config: program.opts().config }));
  });

program
  .command("search <query>")
  .description("grep across all archived transcripts")
  .option("-n, --limit <count>", "max matches to show", (v) => parseInt(v, 10))
  .action(async (query, opts) => {
    process.exit(await runSearch({ ...opts, query, config: program.opts().config }));
  });

program
  .command("analyze")
  .description("run `claude -p` on the archive to extract unfinished work")
  .option("--prompt <text>", "override the analyze prompt")
  .action(async (opts) => {
    process.exit(await runAnalyze({ ...opts, config: program.opts().config }));
  });

program
  .command("install-hook")
  .description("register a Stop hook in ~/.claude/settings.json to auto-sync on session end")
  .option(
    "--debounce <seconds>",
    "skip sync if it already ran within N seconds (default: 30)",
    (v) => parseInt(v, 10),
  )
  .option("--force", "replace any existing cchist hook entries")
  .option("--dry-run", "show what would be written without modifying settings.json")
  .action(async (opts) => {
    process.exit(await runInstallHook(opts));
  });

program.parseAsync(process.argv).catch((err) => {
  if (err instanceof ConfigNotFoundError) {
    log.error(err.message);
  } else {
    log.error((err as Error).stack ?? String(err));
  }
  process.exit(1);
});
