# cchist-web

Read-only web viewer for [cchist](../). Browses Claude Code conversation history stored on object storage (Cloudflare R2, AWS S3, MinIO, Backblaze B2, …).

Built with [Hono](https://hono.dev) + JSX SSR. Single codebase runs on:
- **Cloudflare Workers** — R2 native binding, no credentials inside Worker
- **Node.js** (Railway, Fly, bare VM) — S3-compatible client via `@aws-sdk/client-s3`

## Deploy on Cloudflare Workers

```bash
cd web
npm install

# Create the R2 bucket (matches `bucket_name` in wrangler.toml)
npx wrangler r2 bucket create cchist

# Optional: protect the viewer with basic auth
npx wrangler secret put BASIC_AUTH_USER
npx wrangler secret put BASIC_AUTH_PASS

npm run deploy:cf
```

The `cchist sync` CLI writes `.jsonl` files into the same R2 bucket — point the CLI at the R2 S3 API and the Worker reads them back via the binding (no credentials needed in-Worker).

### wrangler.toml

- `[assets]` directory: `./public` — serves the Tailwind CSS bundle
- `[[r2_buckets]]` binding: `BUCKET` → bucket name `cchist` (edit to your bucket name)
- `compatibility_flags`: `nodejs_compat` (required for the `@aws-sdk/client-s3` dynamic-import path, even though Workers prefer the R2 binding)

## Deploy on Railway

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/new/template?template=https://github.com/InterfaceX-co-jp/cchist/tree/main/web&referralCode=REPLACE_ME)

> Replace `REPLACE_ME` above with your Railway referral code (Account → Referrals).

Set the S3-style env vars below — the Node entry (`src/node.ts`) reads them and falls back to the `@aws-sdk/client-s3` client.

### Required env vars (Node / Railway only)

| name | required | example |
|---|---|---|
| `STORAGE_BUCKET` | yes | `my-cchist-archive` |
| `STORAGE_ACCESS_KEY` | yes | (R2 / S3 access key id) |
| `STORAGE_SECRET_KEY` | yes | (R2 / S3 secret) |
| `STORAGE_ENDPOINT` | for R2 / non-AWS | `https://<account>.r2.cloudflarestorage.com` |
| `STORAGE_REGION` | for AWS S3 | `ap-northeast-1` (R2: `auto`) |
| `STORAGE_PREFIX` | optional | `prod/` |
| `BASIC_AUTH_USER` | recommended | `viewer` |
| `BASIC_AUTH_PASS` | recommended | (strong password) |

On Cloudflare Workers, `STORAGE_*` is ignored — the R2 binding handles list/get directly.

If `BASIC_AUTH_USER` / `BASIC_AUTH_PASS` are unset, the viewer is **public** — anyone with the URL can read your archive. Set both for production (use `wrangler secret put` on Workers).

## Local dev

```bash
cd web
npm install
cp .env.example .env.local   # then fill in values
npm run dev                  # Node + tsx watch + Tailwind build
```

Visit http://localhost:3000.

For local Workers dev (R2 binding via miniflare):

```bash
npm run dev:cf
```

## Scripts

| script | purpose |
|---|---|
| `npm run dev` | Node dev server (`tsx watch src/node.ts`) |
| `npm run dev:cf` | Workers dev via `wrangler dev` |
| `npm run build` | Build Tailwind CSS into `public/styles.css` (Railway uses this) |
| `npm run start` | Production Node start (`tsx src/node.ts`) |
| `npm run deploy:cf` | `wrangler deploy` to Cloudflare |
| `npm run typecheck` | `tsc --noEmit` |

## Architecture

```
src/
├── index.tsx          # Cloudflare Workers entry
├── node.ts            # Node entry (Railway / local)
├── app.tsx            # Hono app — shared by both entries
├── components/
│   └── layout.tsx     # JSX layout
├── routes/
│   ├── home.tsx       # session list
│   └── session.tsx    # JSONL viewer
├── middleware/
│   └── basic-auth.ts  # opt-in HTTP basic auth
├── lib/
│   ├── storage.ts     # R2 binding + @aws-sdk/client-s3 fallback
│   └── jsonl.ts       # parse + extract turns
└── styles/
    └── input.css      # Tailwind v4 source
```

### Storage layer

`src/lib/storage.ts` exposes `listJsonl()` / `getObjectText()` with two backends:

- If `env.BUCKET` (R2 binding) is set → native R2 calls. No credentials, no `@aws-sdk` in hot path.
- Otherwise → dynamic-imports `@aws-sdk/client-s3` and uses `STORAGE_*` env vars.

The dynamic import keeps the Workers bundle slim when the binding is present, and lets the Node build keep full S3 compatibility (AWS, MinIO, B2, etc.).

## How it reads data

The CLI `cchist sync` writes one `.jsonl` per session into your bucket. This app lists those keys and renders each session's user/assistant turns. No database, no writes — strictly read-only.
