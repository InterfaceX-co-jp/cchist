# cchist-web

Read-only web viewer for [cchist](../). Browses Claude Code conversation history stored on S3-compatible object storage (AWS S3, Cloudflare R2, etc.).

## Deploy on Railway

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/new/template?template=https://github.com/InterfaceX-co-jp/cchist/tree/main/web&referralCode=REPLACE_ME)

> Replace `REPLACE_ME` above with your Railway referral code (Account → Referrals). The template URL also needs to be registered as a Railway template via the dashboard for one-click env-var promotion.

## Required env vars

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

If `BASIC_AUTH_USER` / `BASIC_AUTH_PASS` are unset, the viewer is **public** — anyone with the URL can read your archive. Set both for production.

## Local dev

```bash
cd web
npm install
cp .env.example .env.local   # then fill in values
npm run dev
```

Visit http://localhost:3000.

## How it reads data

The CLI `cchist sync` writes one `.jsonl` per session into your bucket. This app lists those keys and renders each session's user/assistant turns. No database, no writes — strictly read-only.
