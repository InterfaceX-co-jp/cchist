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

## ロードマップ

- [ ] `cchist watch`: hook 経由のリアルタイム同期
- [ ] API ログ取り込み(SDK ラッパー or OpenTelemetry コレクタ)
- [ ] Web UI (検索 / セッション差分 / タイムライン)
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
