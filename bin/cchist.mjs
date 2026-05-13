#!/usr/bin/env node
// cchist entry point.
// Tries the prebuilt bundle first, falls back to running TS directly via tsx/bun for dev installs.
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const builtPath = resolve(__dirname, "..", "dist", "cli.mjs");

if (existsSync(builtPath)) {
  await import(builtPath);
} else {
  // Dev mode: try Bun first, then tsx
  const tsEntry = resolve(__dirname, "..", "src", "cli.ts");
  if (!existsSync(tsEntry)) {
    console.error("cchist: no build found and no source available. Run `npm run build` first.");
    process.exit(1);
  }
  const { spawn } = await import("node:child_process");
  const runner = process.versions.bun ? "bun" : "tsx";
  const child = spawn(runner, [tsEntry, ...process.argv.slice(2)], { stdio: "inherit" });
  child.on("exit", (code) => process.exit(code ?? 0));
}
