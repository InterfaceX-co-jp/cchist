import type { FC } from "hono/jsx";
import { Layout } from "../components/layout";
import type { ChatTurn } from "../lib/jsonl";

type Meta = {
  sessionId: string | undefined;
  cwd: string | undefined;
  gitBranch: string | undefined;
  firstTs: string | undefined;
  lastTs: string | undefined;
  turnCount: number;
};

export const SessionPage: FC<{
  objectKey: string;
  meta: Meta;
  turns: ChatTurn[];
}> = ({ objectKey, meta, turns }) => (
  <Layout title={`cchist — ${objectKey}`}>
    <a href="/" class="text-xs text-neutral-500 hover:underline">
      ← back
    </a>
    <h1 class="mt-2 font-mono text-sm break-all">{objectKey}</h1>
    <dl class="mt-3 grid grid-cols-2 gap-2 text-xs text-neutral-600 dark:text-neutral-400">
      <div>
        <dt class="text-neutral-500">sessionId</dt>
        <dd class="font-mono break-all">{meta.sessionId ?? "—"}</dd>
      </div>
      <div>
        <dt class="text-neutral-500">cwd</dt>
        <dd class="font-mono break-all">{meta.cwd ?? "—"}</dd>
      </div>
      <div>
        <dt class="text-neutral-500">branch</dt>
        <dd class="font-mono">{meta.gitBranch ?? "—"}</dd>
      </div>
      <div>
        <dt class="text-neutral-500">turns</dt>
        <dd>{meta.turnCount}</dd>
      </div>
      <div>
        <dt class="text-neutral-500">first</dt>
        <dd class="font-mono">{meta.firstTs ?? "—"}</dd>
      </div>
      <div>
        <dt class="text-neutral-500">last</dt>
        <dd class="font-mono">{meta.lastTs ?? "—"}</dd>
      </div>
    </dl>

    <div class="mt-6 space-y-3">
      {turns.map((t) => (
        <article
          class={
            t.role === "user"
              ? "rounded-md border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-900 dark:bg-blue-950"
              : "rounded-md border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900"
          }
        >
          <header class="mb-1 flex items-center justify-between text-xs text-neutral-500">
            <span class="font-semibold uppercase">{t.role}</span>
            <span class="font-mono">{t.timestamp ?? ""}</span>
          </header>
          <pre class="whitespace-pre-wrap break-words font-sans text-sm">
            {t.text}
          </pre>
        </article>
      ))}
    </div>
  </Layout>
);

export const SessionErrorPage: FC<{ message: string }> = ({ message }) => (
  <Layout>
    <div class="rounded-lg border border-red-300 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950">
      <p class="font-semibold">Failed to load session</p>
      <pre class="mt-2 whitespace-pre-wrap text-xs">{message}</pre>
    </div>
  </Layout>
);
