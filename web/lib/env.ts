function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function optional(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export type StorageEnv = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  prefix: string;
};

export function storageEnv(): StorageEnv {
  return {
    endpoint: optional("STORAGE_ENDPOINT"),
    region: optional("STORAGE_REGION", "auto"),
    bucket: required("STORAGE_BUCKET"),
    accessKey: required("STORAGE_ACCESS_KEY"),
    secretKey: required("STORAGE_SECRET_KEY"),
    prefix: optional("STORAGE_PREFIX"),
  };
}

export function hasBasicAuth(): boolean {
  return !!(process.env.BASIC_AUTH_USER && process.env.BASIC_AUTH_PASS);
}
