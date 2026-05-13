import { spawn } from "node:child_process";

export function runStreaming(cmd: string, args: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "inherit", "inherit"] });
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 0));
  });
}

export function runCapture(
  cmd: string,
  args: string[],
  opts: { input?: string } = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout!.on("data", (d) => (stdout += d.toString()));
    child.stderr!.on("data", (d) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("exit", (code) => resolve({ code: code ?? 0, stdout, stderr }));
    if (opts.input !== undefined) {
      child.stdin!.write(opts.input);
      child.stdin!.end();
    }
  });
}

export async function hasBin(name: string): Promise<boolean> {
  const isWin = process.platform === "win32";
  const probe = isWin ? "where" : "which";
  const { code } = await runCapture(probe, [name]).catch(() => ({ code: 1, stdout: "", stderr: "" }));
  return code === 0;
}
