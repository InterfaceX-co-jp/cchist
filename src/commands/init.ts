import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { defaultConfigToml, expandHome } from "../config.js";
import { log } from "../log.js";

export async function runInit(opts: { path?: string; force?: boolean }): Promise<number> {
  const target = expandHome(opts.path ?? "~/.config/cchist/config.toml");
  if (existsSync(target) && !opts.force) {
    log.error(`config already exists at ${target}. Use --force to overwrite.`);
    return 1;
  }
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, defaultConfigToml());
  log.ok(`wrote starter config to ${target}`);
  log.info(`edit it to add SSH sources, then run \`cchist sync\``);
  return 0;
}
