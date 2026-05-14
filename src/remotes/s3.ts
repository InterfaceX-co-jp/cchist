import type { S3Remote } from "../config.js";
import { runStreaming, hasBin } from "../proc.js";
import { log } from "../log.js";
import type { PushResult } from "./types.js";

/**
 * Mirror the local archive to an S3-compatible bucket via the `aws` CLI.
 *
 * Works for AWS S3 directly and any S3-compatible target (Cloudflare R2,
 * MinIO, Backblaze B2, Wasabi…) by passing `--endpoint-url`.
 *
 * Auth is delegated to the standard AWS credential chain (env vars, named
 * profile, IMDS, etc.) — cchist never touches secrets directly.
 */
export async function pushS3(
  remote: S3Remote,
  storage: string,
  opts: { dryRun?: boolean } = {},
): Promise<PushResult> {
  if (!(await hasBin("aws"))) {
    return {
      remote: remote.name,
      ok: false,
      reason: "`aws` CLI not found in PATH (install it to use S3/R2 remotes)",
    };
  }

  const prefix = remote.prefix ? trimSlashes(remote.prefix) : "";
  const target = `s3://${remote.bucket}${prefix ? "/" + prefix : ""}`;

  const args = ["s3", "sync", trailingSlash(storage), target];

  // Exclude cchist's own manifest by default — it's metadata, not transcript content.
  // Users can override via extra_args if they want it pushed.
  args.push("--exclude", ".cchist-manifest.json");

  const wantDelete = remote.delete ?? true;
  if (wantDelete) args.push("--delete");

  if (remote.endpoint) args.push("--endpoint-url", remote.endpoint);
  if (remote.region) args.push("--region", remote.region);
  if (remote.profile) args.push("--profile", remote.profile);
  if (opts.dryRun) args.push("--dryrun");
  if (remote.extra_args?.length) args.push(...remote.extra_args);

  log.dim(`  aws ${args.join(" ")}`);
  const code = await runStreaming("aws", args);
  if (code !== 0) {
    return { remote: remote.name, ok: false, reason: `aws s3 sync exit ${code}` };
  }
  return { remote: remote.name, ok: true, uri: target };
}

function trailingSlash(p: string): string {
  return p.endsWith("/") ? p : `${p}/`;
}

function trimSlashes(p: string): string {
  return p.replace(/^\/+|\/+$/g, "");
}
