/**
 * cchist install-hook
 *
 * Registers a `Stop` hook in ~/.claude/settings.json that runs
 * `cchist sync --only local` every time a Claude Code session ends.
 *
 * Idempotent: re-running the command is a no-op unless --force is passed.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { log } from "../log.js";

/** A single hook entry in Claude's settings.json */
type HookEntry = {
  type: "command";
  command: string;
};

/** One element of the hooks[Event] array */
type HookMatcher = {
  matcher: string;
  hooks: HookEntry[];
};

/** Minimal shape of ~/.claude/settings.json we care about */
type ClaudeSettings = {
  hooks?: Record<string, HookMatcher[]>;
  [key: string]: unknown;
};

const DEFAULT_SETTINGS_PATH = join(homedir(), ".claude", "settings.json");
const HOOK_EVENT = "Stop";
const HOOK_COMMAND_PREFIX = "cchist sync";

function buildHookCommand(debounce: number): string {
  const base = "cchist sync --only local";
  return debounce > 0 ? `${base} --debounce ${debounce}` : base;
}

/**
 * Returns true if any existing hook entry already matches the given command
 * so we can skip re-adding it (idempotency check).
 */
function hookAlreadyPresent(settings: ClaudeSettings, command: string): boolean {
  const matchers = settings.hooks?.[HOOK_EVENT] ?? [];
  return matchers.some((m) => m.hooks.some((h) => h.command === command));
}

/**
 * Removes all hook entries whose command starts with "cchist sync"
 * from the Stop event list. Used by --force to clean up before re-adding.
 */
function removeCchistHooks(matchers: HookMatcher[]): HookMatcher[] {
  return matchers
    .map((m) => ({
      ...m,
      hooks: m.hooks.filter((h) => !h.command.startsWith(HOOK_COMMAND_PREFIX)),
    }))
    .filter((m) => m.hooks.length > 0);
}

export async function runInstallHook(opts: {
  debounce?: number;
  force?: boolean;
  dryRun?: boolean;
  /** Override settings path (used in tests) */
  settingsPath?: string;
}): Promise<number> {
  const settingsPath = opts.settingsPath ?? DEFAULT_SETTINGS_PATH;
  const debounce = opts.debounce ?? 30;
  const hookCommand = buildHookCommand(debounce);

  // ── Read existing settings ──────────────────────────────────────────────
  let settings: ClaudeSettings = {};
  if (existsSync(settingsPath)) {
    const raw = await readFile(settingsPath, "utf8");
    try {
      settings = JSON.parse(raw) as ClaudeSettings;
    } catch (err) {
      log.error(
        `Could not parse ${settingsPath}: ${(err as Error).message}\n` +
          `Fix or delete the file, then re-run \`cchist install-hook\`.`,
      );
      return 1;
    }
  }

  // ── Idempotency check ───────────────────────────────────────────────────
  if (hookAlreadyPresent(settings, hookCommand) && !opts.force) {
    log.ok(`cchist hook already registered in ${settingsPath}`);
    log.dim(`  command: ${hookCommand}`);
    log.dim(`  (use --force to re-register)`);
    return 0;
  }

  // ── Build updated settings ──────────────────────────────────────────────
  if (!settings.hooks) settings.hooks = {};

  const existingMatchers: HookMatcher[] = settings.hooks[HOOK_EVENT] ?? [];
  const cleaned = opts.force ? removeCchistHooks(existingMatchers) : existingMatchers;

  const newMatcher: HookMatcher = {
    matcher: "",
    hooks: [{ type: "command", command: hookCommand }],
  };

  settings.hooks[HOOK_EVENT] = [...cleaned, newMatcher];

  const json = JSON.stringify(settings, null, 2);

  // ── Dry-run ─────────────────────────────────────────────────────────────
  if (opts.dryRun) {
    log.info(`[dry-run] would write to ${settingsPath}:`);
    console.log(json);
    return 0;
  }

  // ── Write ────────────────────────────────────────────────────────────────
  await mkdir(dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, json + "\n", "utf8");

  log.ok(`hook installed → ${settingsPath}`);
  log.info(`event   : ${HOOK_EVENT}`);
  log.info(`command : ${hookCommand}`);
  if (debounce > 0) {
    log.dim(`debounce: ${debounce}s — sync is skipped if it already ran within ${debounce}s`);
  }
  log.dim(`\nRestart Claude Code for the hook to take effect.`);
  return 0;
}
