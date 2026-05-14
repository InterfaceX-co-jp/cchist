import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { storageEnv, type StorageEnv } from "./env";

let _client: { client: S3Client; env: StorageEnv } | null = null;

function client(): { client: S3Client; env: StorageEnv } {
  if (_client) return _client;
  const env = storageEnv();
  const c = new S3Client({
    region: env.region,
    endpoint: env.endpoint || undefined,
    forcePathStyle: !!env.endpoint,
    credentials: {
      accessKeyId: env.accessKey,
      secretAccessKey: env.secretKey,
    },
  });
  _client = { client: c, env };
  return _client;
}

export type ObjectEntry = {
  key: string;
  size: number;
  lastModified: Date | undefined;
};

function joinPrefix(...parts: string[]): string {
  return parts
    .filter(Boolean)
    .map((p) => p.replace(/^\/+|\/+$/g, ""))
    .join("/");
}

export async function listJsonl(subPrefix = ""): Promise<ObjectEntry[]> {
  const { client: c, env } = client();
  const fullPrefix = joinPrefix(env.prefix, subPrefix);
  const results: ObjectEntry[] = [];
  let token: string | undefined = undefined;

  do {
    const res = await c.send(
      new ListObjectsV2Command({
        Bucket: env.bucket,
        Prefix: fullPrefix ? fullPrefix + "/" : undefined,
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

  results.sort((a, b) => {
    const ta = a.lastModified?.getTime() ?? 0;
    const tb = b.lastModified?.getTime() ?? 0;
    return tb - ta;
  });

  return results;
}

export async function getObjectText(key: string): Promise<string> {
  const { client: c, env } = client();
  const res = await c.send(
    new GetObjectCommand({
      Bucket: env.bucket,
      Key: key,
    }),
  );
  if (!res.Body) throw new Error(`empty body for ${key}`);
  return await res.Body.transformToString("utf-8");
}
