import Link from "next/link";
import { listJsonl } from "@/lib/s3";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(d: Date | undefined): string {
  if (!d) return "—";
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

export default async function Home() {
  let entries;
  try {
    entries = await listJsonl();
  } catch (err) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950">
        <p className="font-semibold">Failed to list bucket</p>
        <pre className="mt-2 whitespace-pre-wrap text-xs">
          {err instanceof Error ? err.message : String(err)}
        </pre>
        <p className="mt-2 text-xs text-neutral-500">
          Check STORAGE_* env vars on this Railway service.
        </p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-6 text-sm dark:border-neutral-800 dark:bg-neutral-900">
        <p className="font-semibold">No sessions found.</p>
        <p className="mt-2 text-neutral-500">
          Run <code className="font-mono">cchist sync</code> locally to push
          your archive to this bucket.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-lg font-semibold mb-3">
        Sessions <span className="text-neutral-500">({entries.length})</span>
      </h1>
      <ul className="space-y-1">
        {entries.map((e) => (
          <li
            key={e.key}
            className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:bg-neutral-800"
          >
            <Link
              href={`/session/${encodeURIComponent(e.key)}`}
              className="block"
            >
              <div className="font-mono text-xs truncate">{e.key}</div>
              <div className="mt-0.5 text-xs text-neutral-500">
                {formatDate(e.lastModified)} · {formatBytes(e.size)}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
