import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, join } from "node:path";
import { parse as parseToml } from "smol-toml";

export type LocalSource = {
  kind: "local";
  name: string;
  path: string;
};

export type SshSource = {
  kind: "ssh";
  name: string;
  host: string;
  remote_path: string;
  /** Optional explicit user; otherwise resolved from ~/.ssh/config */
  user?: string;
  /** Extra rsync flags */
  rsync_args?: string[];
};

export type ZipSource = {
  kind: "zip";
  name: string;
  path: string;
};

export type Source = LocalSource | SshSource | ZipSource;

export type S3Remote = {
  kind: "s3";
  name: string;
  bucket: string;
  /** Optional key prefix inside the bucket */
  prefix?: string;
  /** Optional S3-compatible endpoint (Cloudflare R2, MinIO, Backblaze B2…) */
  endpoint?: string;
  /** Required for R2: "auto". Optional for AWS S3 if AWS_REGION is set */
  region?: string;
  /** AWS named profile to use (resolves credentials via standard chain) */
  profile?: string;
  /** Extra args appended to `aws s3 sync` */
  extra_args?: string[];
  /** Delete remote objects not in local (mirrors `rsync --delete`). Default true */
  delete?: boolean;
};

export type Remote = S3Remote;

export type Config = {
  storage: string;
  sources: Source[];
  remotes: Remote[];
  /** Override which `claude` binary to invoke for --analyze */
  claude_bin?: string;
};

export function expandHome(p: string): string {
  if (p.startsWith("~/") || p === "~") {
    return p.replace(/^~/, homedir());
  }
  return p;
}

function defaultConfigPath(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg ?? join(homedir(), ".config");
  return join(base, "cchist", "config.toml");
}

export function configSearchPaths(): string[] {
  return [
    process.env.CCHIST_CONFIG ?? "",
    "./cchist.toml",
    "./.cchist.toml",
    defaultConfigPath(),
  ].filter(Boolean);
}

export async function loadConfig(explicitPath?: string): Promise<Config> {
  const candidates = explicitPath
    ? [explicitPath]
    : configSearchPaths();

  for (const candidate of candidates) {
    const abs = resolve(expandHome(candidate));
    if (existsSync(abs)) {
      const raw = await readFile(abs, "utf8");
      const parsed = parseToml(raw) as Record<string, unknown>;
      return normalizeConfig(parsed, abs);
    }
  }

  throw new ConfigNotFoundError(candidates);
}

export class ConfigNotFoundError extends Error {
  constructor(public readonly searched: string[]) {
    super(
      `No cchist config found. Searched:\n  ${searched.join("\n  ")}\n\nRun \`cchist init\` to create one.`,
    );
    this.name = "ConfigNotFoundError";
  }
}

function normalizeConfig(raw: Record<string, unknown>, configPath: string): Config {
  const storage = typeof raw.storage === "string"
    ? expandHome(raw.storage)
    : expandHome("~/cchist-archive");

  const sourcesRaw = (raw.source ?? raw.sources ?? []) as Array<Record<string, unknown>>;
  if (!Array.isArray(sourcesRaw)) {
    throw new Error(`${configPath}: 'source' must be an array of tables ([[source]])`);
  }

  const sources: Source[] = sourcesRaw.map((s, i) => {
    const name = String(s.name ?? `source_${i}`);
    const kind = String(s.kind ?? "local");
    switch (kind) {
      case "local":
        return {
          kind,
          name,
          path: expandHome(String(s.path ?? "~/.claude/projects")),
        };
      case "ssh":
        if (typeof s.host !== "string") {
          throw new Error(`source[${name}]: 'host' required for ssh source`);
        }
        return {
          kind,
          name,
          host: s.host,
          remote_path: String(s.remote_path ?? "~/.claude/projects"),
          user: typeof s.user === "string" ? s.user : undefined,
          rsync_args: Array.isArray(s.rsync_args)
            ? (s.rsync_args as string[])
            : undefined,
        };
      case "zip":
        return {
          kind,
          name,
          path: expandHome(String(s.path ?? "")),
        };
      default:
        throw new Error(`source[${name}]: unknown kind '${kind}'`);
    }
  });

  const remotes = normalizeRemotes(raw, configPath);

  return {
    storage,
    sources,
    remotes,
    claude_bin: typeof raw.claude_bin === "string" ? raw.claude_bin : undefined,
  };
}

function normalizeRemotes(raw: Record<string, unknown>, configPath: string): Remote[] {
  // Accept both single `[remote]` table and `[[remote]]` array-of-tables.
  const rawRemotes = raw.remote ?? raw.remotes;
  if (rawRemotes === undefined) return [];

  const entries: Array<Record<string, unknown>> = Array.isArray(rawRemotes)
    ? (rawRemotes as Array<Record<string, unknown>>)
    : [rawRemotes as Record<string, unknown>];

  return entries.map((r, i) => {
    const name = String(r.name ?? `remote_${i}`);
    const kind = String(r.kind ?? "s3");
    switch (kind) {
      case "s3":
      case "r2": {
        if (typeof r.bucket !== "string" || !r.bucket) {
          throw new Error(`${configPath}: remote[${name}] requires 'bucket'`);
        }
        return {
          kind: "s3",
          name,
          bucket: r.bucket,
          prefix: typeof r.prefix === "string" ? r.prefix : undefined,
          endpoint: typeof r.endpoint === "string" ? r.endpoint : undefined,
          region: typeof r.region === "string" ? r.region : undefined,
          profile: typeof r.profile === "string" ? r.profile : undefined,
          extra_args: Array.isArray(r.extra_args) ? (r.extra_args as string[]) : undefined,
          delete: typeof r.delete === "boolean" ? r.delete : undefined,
        };
      }
      default:
        throw new Error(`${configPath}: remote[${name}] unknown kind '${kind}'`);
    }
  });
}

export function defaultConfigToml(): string {
  return `# cchist configuration
# Docs: https://github.com/InterfaceX-co-jp/cchist

# Where collected jsonl files are mirrored to
storage = "~/cchist-archive"

# Optional: override the claude binary used for --analyze
# claude_bin = "claude"

# --- Sources ---
# Each [[source]] is one place to pull conversation history from.

[[source]]
name = "local"
kind = "local"
path = "~/.claude/projects"

# Example SSH source (uses ~/.ssh/config for host resolution)
# [[source]]
# name = "vps"
# kind = "ssh"
# host = "my-vps"
# remote_path = "~/.claude/projects"

# Example Claude.ai export ZIP
# [[source]]
# name = "claude-ai"
# kind = "zip"
# path = "~/Downloads/claude-export.zip"

# --- Optional: push archive to S3-compatible object storage ---
# Requires the \`aws\` CLI on PATH. After local sync completes,
# the archive is mirrored via \`aws s3 sync\`.
#
# AWS S3:
# [[remote]]
# name = "s3-backup"
# kind = "s3"
# bucket = "my-cchist"
# prefix = "archive"
# region = "us-east-1"
#
# Cloudflare R2 (S3-compatible):
# [[remote]]
# name = "r2-backup"
# kind = "s3"
# bucket = "my-cchist"
# prefix = "archive"
# region = "auto"
# endpoint = "https://<ACCOUNT_ID>.r2.cloudflarestorage.com"
# # Credentials: set AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
# # (R2 API tokens), or use \`profile = "r2"\` with ~/.aws/credentials.
`;
}

export { defaultConfigPath };
