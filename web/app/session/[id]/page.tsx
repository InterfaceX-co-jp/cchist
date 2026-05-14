import Link from "next/link";
import { getObjectText } from "@/lib/s3";
import { parseJsonl, extractTurns, sessionMeta } from "@/lib/jsonl";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const key = decodeURIComponent(id);

  let text: string;
  try {
    text = await getObjectText(key);
  } catch (err) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm dark:border-red-900 dark:bg-red-950">
        <p className="font-semibold">Failed to load session</p>
        <pre className="mt-2 whitespace-pre-wrap text-xs">
          {err instanceof Error ? err.message : String(err)}
        </pre>
      </div>
    );
  }

  const records = parseJsonl(text);
  const meta = sessionMeta(records);
  const turns = extractTurns(records);

  return (
    <div>
      <Link
        href="/"
        className="text-xs text-neutral-500 hover:underline"
      >
        ← back
      </Link>
      <h1 className="mt-2 font-mono text-sm break-all">{key}</h1>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-neutral-600 dark:text-neutral-400">
        <div>
          <dt className="text-neutral-500">sessionId</dt>
          <dd className="font-mono break-all">{meta.sessionId ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">cwd</dt>
          <dd className="font-mono break-all">{meta.cwd ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">branch</dt>
          <dd className="font-mono">{meta.gitBranch ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">turns</dt>
          <dd>{meta.turnCount}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">first</dt>
          <dd className="font-mono">{meta.firstTs ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">last</dt>
          <dd className="font-mono">{meta.lastTs ?? "—"}</dd>
        </div>
      </dl>

      <div className="mt-6 space-y-3">
        {turns.map((t, i) => (
          <article
            key={i}
            className={
              t.role === "user"
                ? "rounded-md border border-blue-200 bg-blue-50 p-3 text-sm dark:border-blue-900 dark:bg-blue-950"
                : "rounded-md border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900"
            }
          >
            <header className="mb-1 flex items-center justify-between text-xs text-neutral-500">
              <span className="font-semibold uppercase">{t.role}</span>
              <span className="font-mono">{t.timestamp ?? ""}</span>
            </header>
            <pre className="whitespace-pre-wrap break-words font-sans text-sm">
              {t.text}
            </pre>
          </article>
        ))}
      </div>
    </div>
  );
}
