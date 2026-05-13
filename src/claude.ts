import { spawn } from "node:child_process";
import { hasBin } from "./proc.js";
import { log } from "./log.js";

export async function ensureClaudeAvailable(claudeBin: string): Promise<boolean> {
  return await hasBin(claudeBin);
}

/**
 * Run `claude -p <prompt>` in the given working directory and stream stdout/stderr.
 * Returns the exit code.
 */
export function runClaude(opts: {
  bin: string;
  cwd: string;
  prompt: string;
  extraArgs?: string[];
}): Promise<number> {
  log.dim(`spawning: ${opts.bin} -p (cwd=${opts.cwd})`);
  return new Promise((resolve, reject) => {
    const args = ["-p", opts.prompt, ...(opts.extraArgs ?? [])];
    const child = spawn(opts.bin, args, {
      cwd: opts.cwd,
      stdio: ["ignore", "inherit", "inherit"],
      env: process.env,
    });
    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 0));
  });
}

export function buildAnalyzePrompt(archiveRoot: string): string {
  return [
    `あなたは ${archiveRoot} 配下に集約された Claude の会話履歴(.jsonl)を読むエージェントです。`,
    `これは複数のマシン・複数の Claude プロダクト(Claude Code, Claude.ai export 等)から rsync/cp で集めた生の transcript です。`,
    ``,
    `タスク:`,
    `1. ${archiveRoot} 配下を再帰的に読み、各セッションのトピックを把握する。`,
    `2. **未完了タスク**(言及されたが完了していない実装・調査・意思決定)を抽出する。`,
    `3. **宙に浮いた検討事項**(議論されたが結論が出ていない設計判断、TODO的発言、保留中の検討)を抽出する。`,
    `4. **再開可能なコンテキスト**(セッションをまたいで継続中のプロジェクト・テーマ)をグルーピングする。`,
    ``,
    `出力フォーマット: 日本語の markdown。セクションは「未完了タスク」「宙に浮いた検討事項」「継続中のテーマ」の3つ。`,
    `各項目には、出典セッションのパス(${archiveRoot} からの相対)と最終言及日を添える。`,
    ``,
    `重要: 推測で作話しない。実際に jsonl に書かれている内容のみを根拠にする。`,
  ].join("\n");
}
