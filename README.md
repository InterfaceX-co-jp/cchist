# cchist

> **One command. All your Claude conversations. One place.**

`cchist` は、複数のマシンに散らばった Claude Code のセッション履歴(`~/.claude/projects/**/*.jsonl`)と、Claude.ai のエクスポート ZIP を、ローカルの1ディレクトリに集約する CLI ツールです。集約後はそのまま `claude -p` に投げて「未完了タスク」「宙に浮いた検討事項」を自動抽出できます。

---

## なぜ作ったか

Claude を本気で使っていると、会話履歴が

- ローカルマシン (`~/.claude/projects/`)
- VPS / リモート開発機 (同上)
- Claude.ai (Web/モバイル)
- API 直叩きしているアプリのログ

…と複数の場所に分散していき、**「あの議論どこでやったっけ?」「あの設計、結論出てたっけ?」が即座にわからなくなる**問題があります。

`cchist` は SSH と rsync を裏で叩くだけのシンプルな配管屋で、`cchist sync` 一発で全部を1ディレクトリにミラーします。さらに `--analyze` フラグを付けると、集約後に `claude -p` を spawn して、横断的に未完了タスクを markdown で出してくれます。

---

## Quick Start

```bash
# 1. インストール
npm install -g cchist        # or: bun add -g cchist / pnpm add -g cchist

# 2. 設定ファイルを作る
cchist init

# 3. ~/.config/cchist/config.toml を編集して SSH ソース等を追加
$EDITOR ~/.config/cchist/config.toml

# 4. 同期
cchist sync

# 5. 横断で「未完了タスク」を抽出
cchist sync --analyze
# または
cchist analyze
```

---

## 設定ファイル

`~/.config/cchist/config.toml`:

```toml
storage = "~/cchist-archive"

[[source]]
name = "local"
kind = "local"
path = "~/.claude/projects"

[[source]]
name = "vps"
kind = "ssh"
host = "my-vps"            # ~/.ssh/config を使う
remote_path = "~/.claude/projects"

[[source]]
name = "claude-ai"
kind = "zip"
path = "~/Downloads/claude-export.zip"
```

### 対応ソース

| kind  | 説明 | 必要なもの |
|-------|------|-----------|
| `local` | ローカルのディレクトリ | rsync (推奨) または cp |
| `ssh`   | SSH 経由のリモート | rsync, ssh, `~/.ssh/config` 設定済み |
| `zip`   | Claude.ai のデータエクスポート ZIP | unzip |

### BYO クラウドストレージ (任意)

`[[remote]]` を追加するとローカル sync 完了後にアーカイブを S3 互換オブジェクトストレージへ自動ミラーします。`aws` CLI を裏で叩くだけなので、AWS S3 / Cloudflare R2 / MinIO / Backblaze B2 / Wasabi いずれも同じ設定で動きます。

```toml
# AWS S3
[[remote]]
name = "s3-backup"
kind = "s3"
bucket = "my-cchist-archive"
prefix = "archive"
region = "us-east-1"

# Cloudflare R2 (S3 互換)
[[remote]]
name = "r2-backup"
kind = "s3"
bucket = "my-cchist-archive"
prefix = "archive"
region = "auto"
endpoint = "https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
```

認証は標準 AWS チェーン (環境変数 `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`、`~/.aws/credentials`、IMDS 等)。`cchist` 自身は秘密情報を読みません。R2 の場合は R2 API トークンを上記環境変数として export してください。

| フラグ | 効果 |
|--------|------|
| `--skip-remote` | リモートプッシュをスキップ (ローカル sync のみ) |
| `--remote-only` | ソース sync をスキップし、既存アーカイブをリモートに再 push |
| `--only-remote <name...>` | 指定 remote だけに push |
| `--dry-run` | `aws s3 sync --dryrun` を含めて何が転送されるか表示 |

---

## コマンド

```bash
cchist init                  # ~/.config/cchist/config.toml を生成
cchist sync                  # 全ソースから同期
cchist sync --only local vps # 特定ソースだけ
cchist sync --dry-run        # 何をやるか確認
cchist sync --analyze        # 同期 + claude -p で分析
cchist list                  # アーカイブ内のセッション一覧(新しい順)
cchist list --source vps     # ソース絞り込み
cchist list --json           # JSON 出力
cchist search "ERC-4337"     # 横断 grep
cchist analyze               # 同期せずに分析だけ実行
cchist analyze --prompt "..." # プロンプト差し替え
```

---

## 動作原理

1. **ソース ごとに `~/cchist-archive/<source-name>/` を作る**
2. SSH ソースなら `rsync -az --delete --include='*.jsonl' ...` でリモートからミラー
3. ZIP ソースなら `unzip` で展開し、`conversations.json` を per-conversation な jsonl に分解
4. `--analyze` 時は `claude -p "<archive を読んで未完了タスクを抽出して>"` を `~/cchist-archive` を cwd にして spawn

**重要: `cchist` 自身に LLM ロジックは無い。**Anthropic API キーも不要。`claude` CLI が既に認証済みであることだけが前提です。

---

## セキュリティ

- 集約された jsonl にはコード差分、コマンド履歴、場合によっては `.env` の中身まで含まれます
- `~/cchist-archive` のパーミッションは自分で管理してください(デフォルトはユーザのデフォルト umask)
- SSH ソースは `BatchMode=yes` で動くので、ssh-agent or 鍵認証が必要

---

## 開発

```bash
git clone https://github.com/InterfaceX-co-jp/cchist
cd cchist
bun install    # or npm install / pnpm install
bun run src/cli.ts --help   # dev
bun run build  # → dist/cli.mjs
```

---

## Web ビューワ (Railway 一発デプロイ)

CLI で S3 / R2 に push したアーカイブを、ブラウザで閲覧する読取専用 Next.js アプリ。コードは [`web/`](./web/)。

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/new/template?template=https://github.com/InterfaceX-co-jp/cchist/tree/main/web&referralCode=REPLACE_ME)

- セルフホスト前提 (SaaS 提供なし) — 自分の Railway アカウントで動かす
- DB 不要 — bucket をそのまま読む
- HTTP Basic Auth で保護 (`BASIC_AUTH_USER` / `BASIC_AUTH_PASS`)
- 必要な env vars は [`web/README.md`](./web/README.md) 参照

> ボタンの `REPLACE_ME` を Railway の referral code に置換、かつ Railway dashboard で template として登録すると、ワンクリックで env var 入力フォームに遷移 → デプロイまで進む。

---

## ロードマップ

- [ ] `cchist watch`: hook 経由のリアルタイム同期
- [ ] API ログ取り込み(SDK ラッパー or OpenTelemetry コレクタ)
- [x] Web UI (検索 / セッション差分 / タイムライン) — [`web/`](./web/)
- [ ] 個別セッションを markdown にエクスポート
- [ ] memory のエクスポート(claude.ai)取り込み

---

## License

MIT © InterfaceX Co., Ltd.

---

## English

`cchist` is a single-command CLI that aggregates Claude conversation history (Claude Code `~/.claude/projects/**/*.jsonl` plus claude.ai export ZIPs) from multiple machines into one local archive. Optionally pipes the archive into `claude -p` to extract unfinished tasks across all sessions.

```bash
npm install -g cchist
cchist init
$EDITOR ~/.config/cchist/config.toml   # add your SSH hosts
cchist sync --analyze
```

`cchist` is a thin plumbing layer: rsync for transfers, `claude -p` for analysis. No API keys needed; uses your existing `claude` auth. See [examples/config.example.toml](examples/config.example.toml) for full config reference.
