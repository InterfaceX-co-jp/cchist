import type { FC, PropsWithChildren } from "hono/jsx";

export const Layout: FC<PropsWithChildren<{ title?: string }>> = ({
  title,
  children,
}) => {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title ?? "cchist — Claude conversation archive"}</title>
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body class="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <header class="border-b border-neutral-200 dark:border-neutral-800">
          <div class="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
            <a href="/" class="font-mono text-sm font-semibold">
              cchist
            </a>
            <span class="text-xs text-neutral-500">self-hosted</span>
          </div>
        </header>
        <main class="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
};
