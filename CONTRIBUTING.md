# Contributing to cchist

Thanks for your interest! `cchist` is intentionally small — the core is a few hundred lines of TS that shells out to `rsync` and `claude`. PRs welcome for:

- New source kinds (e.g., S3, GCS, gist, generic HTTP archive)
- Better Claude.ai export parsing (the schema evolves)
- Watch mode using Claude Code hooks
- API logging sidecar (SDK wrapper or OTel collector)
- Cross-platform polish (Windows support is currently best-effort)

## Dev setup

```bash
git clone https://github.com/InterfaceX-co-jp/cchist
cd cchist
bun install   # or npm install
bun run typecheck
bun run src/cli.ts --help
```

## Style

- TypeScript strict mode, no `any` without justification
- Subprocess invocation goes through `src/proc.ts`
- New source kinds: add `src/sources/<kind>.ts`, register in `src/commands/sync.ts`
- Keep external deps minimal (currently: commander, smol-toml)

## Testing locally

Create a fake Claude Code project tree and a config pointing at it:

```bash
mkdir -p /tmp/fake/projects/test
echo '{"type":"user","message":{"role":"user","content":"hi"}}' > /tmp/fake/projects/test/s.jsonl

cat > /tmp/cchist.toml <<EOF
storage = "/tmp/archive"
[[source]]
name = "test"
kind = "local"
path = "/tmp/fake/projects"
EOF

bun run src/cli.ts --config /tmp/cchist.toml sync
bun run src/cli.ts --config /tmp/cchist.toml list
```
