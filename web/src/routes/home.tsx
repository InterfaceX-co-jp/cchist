import type { FC } from "hono/jsx";
import { Layout } from "../components/layout";
import type { ObjectEntry } from "../lib/storage";

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(d: Date | undefined): string {
  if (!d) return "—";
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

export const HomePage: FC<{ entries: ObjectEntry[] }> = ({ entries }) => {
  if (entries.length === 0) {
    return (
      <Layout>
        <div class="rounded-lg border border-neutral-200 bg-white p-6 text-sm dark:border-neutral-800 dark:bg-neutral-900">
          <p class="font-semibold">No sessions found.</p>
          <p class="mt-2 text-neutral-500">
            Run <code class="font-mono">cchist sync</code> locally to push your
            archive to this bucket.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <h1 class="text-lg font-semibold mb-3">
        Sessions <span class="text-neutral-500">({entries.length})</span>
      </h1>
      <ul class="space-y-1">
        {entries.map((e) => (
          <li class="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800">
            <a href={`/session/${encodeURIComponent(e.key)}`} class="block">
              <div class="font-mono text-xs truncate">{e.key}</div>
              <div class="mt-0.5 text-xs text-neutral-500">
                {formatDate(e.lastModified)} · {formatBytes(e.size)}
              </div>
            </a>
          </li>
        ))}
      </ul>
    </Layout>
  );
};

export const ErrorPage: FC<{ message: string; hint?: string }> = ({
  message,
  hint,
}) => (
  <Layout>
    <div class="rounded-lg border border-red-300 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950">
      <p class="font-semibold">Failed to list bucket</p>
      <pre class="mt-2 whitespace-pre-wrap text-xs">{message}</pre>
      {hint ? <p class="mt-2 text-xs text-neutral-500">{hint}</p> : null}
    </div>
  </Layout>
);
