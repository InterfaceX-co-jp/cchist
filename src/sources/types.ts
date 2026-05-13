export type SyncResult =
  | { source: string; ok: true; dest: string }
  | { source: string; ok: false; reason: string };
