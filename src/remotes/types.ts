export type PushResult =
  | { remote: string; ok: true; uri: string }
  | { remote: string; ok: false; reason: string };
