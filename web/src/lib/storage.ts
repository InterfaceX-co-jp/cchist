// Storage layer with dual backend:
//   - Cloudflare R2 native binding (preferred when c.env.BUCKET exists)
//   - AWS S3 / S3-compatible via @aws-sdk/client-s3 (Node/Railway fallback)
//
// Both expose the same ObjectEntry surface so routes don't care which path runs.

import type { R2Bucket } from "@cloudflare/workers-types";

export type ObjectEntry = {
  key: string;
  size: number;
  lastModified: Date | undefined;
};

export type StorageBindings = {
  BUCKET?: R2Bucket;
  STORAGE_PREFIX?: string;

  // S3 fallback (only consulted when BUCKET binding is absent)
  STORAGE_ENDPOINT?: string;
  STORAGE_REGION?: string;
  STORAGE_BUCKET?: string;
  STORAGE_ACCESS_KEY?: string;
  STORAGE_SECRET_KEY?: string;
};

function joinPrefix(...parts: (string | undefined)[]): string {
  return parts
    .filter((p): p is string => !!p)
    .map((p) => p.replace(/^\/+|\/+$/g, ""))
    .join("/");
}

export async function listJsonl(
  env: StorageBindings,
  subPrefix = "",
): Promise<ObjectEntry[]> {
  const prefix = joinPrefix(env.STORAGE_PREFIX, subPrefix);
  const fullPrefix = prefix ? prefix + "/" : "";

  if (env.BUCKET) {
    return listJsonlR2(env.BUCKET, fullPrefix);
  }
  return listJsonlS3(env, fullPrefix);
}

export async function getObjectText(
  env: StorageBindings,
  key: string,
): Promise<string> {
  if (env.BUCKET) {
    const obj = await env.BUCKET.get(key);
    if (!obj) throw new Error(`object not found: ${key}`);
    return await obj.text();
  }
  return getObjectTextS3(env, key);
}

// ── R2 native ──────────────────────────────────────────────────────────

async function listJsonlR2(
  bucket: R2Bucket,
  prefix: string,
): Promise<ObjectEntry[]> {
  const results: ObjectEntry[] = [];
  let cursor: string | undefined;

  do {
    const res = await bucket.list({
      prefix: prefix || undefined,
      limit: 1000,
      cursor,
    });
    for (const obj of res.objects) {
      if (!obj.key.endsWith(".jsonl")) continue;
      results.push({
        key: obj.key,
        size: obj.size,
        lastModified: obj.uploaded,
      });
    }
    cursor = res.truncated ? res.cursor : undefined;
  } while (cursor);

  results.sort(byLastModifiedDesc);
  return results;
}

// ── S3 fallback (lazy import — keeps Workers bundle slim if unused) ────

async function listJsonlS3(
  env: StorageBindings,
  prefix: string,
): Promise<ObjectEntry[]> {
  const { client, bucket } = await s3Client(env);
  const { ListObjectsV2Command } = await import("@aws-sdk/client-s3");
  const results: ObjectEntry[] = [];
  let token: string | undefined;

  do {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix || undefined,
        ContinuationToken: token,
        MaxKeys: 1000,
      }),
    );
    for (const obj of res.Contents ?? []) {
      if (!obj.Key) continue;
      if (!obj.Key.endsWith(".jsonl")) continue;
      results.push({
        key: obj.Key,
        size: obj.Size ?? 0,
        lastModified: obj.LastModified,
      });
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);

  results.sort(byLastModifiedDesc);
  return results;
}

async function getObjectTextS3(
  env: StorageBindings,
  key: string,
): Promise<string> {
  const { client, bucket } = await s3Client(env);
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const res = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  if (!res.Body) throw new Error(`empty body for ${key}`);
  return await res.Body.transformToString("utf-8");
}

async function s3Client(env: StorageBindings) {
  const bucket = env.STORAGE_BUCKET;
  const accessKey = env.STORAGE_ACCESS_KEY;
  const secretKey = env.STORAGE_SECRET_KEY;
  if (!bucket || !accessKey || !secretKey) {
    throw new Error(
      "No storage backend configured. Bind R2 (BUCKET) or set STORAGE_BUCKET/ACCESS_KEY/SECRET_KEY.",
    );
  }
  const { S3Client } = await import("@aws-sdk/client-s3");
  const endpoint = env.STORAGE_ENDPOINT;
  const client = new S3Client({
    region: env.STORAGE_REGION || "auto",
    endpoint: endpoint || undefined,
    forcePathStyle: !!endpoint,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  });
  return { client, bucket };
}

function byLastModifiedDesc(a: ObjectEntry, b: ObjectEntry): number {
  const ta = a.lastModified?.getTime() ?? 0;
  const tb = b.lastModified?.getTime() ?? 0;
  return tb - ta;
}
