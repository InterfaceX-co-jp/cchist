import { Hono } from "hono";
import { basicAuth, type BasicAuthBindings } from "./middleware/basic-auth";
import {
  listJsonl,
  getObjectText,
  type StorageBindings,
} from "./lib/storage";
import { extractTurns, parseJsonl, sessionMeta } from "./lib/jsonl";
import { HomePage, ErrorPage } from "./routes/home";
import { SessionPage, SessionErrorPage } from "./routes/session";

export type AppBindings = StorageBindings & BasicAuthBindings;

export function createApp() {
  const app = new Hono<{ Bindings: AppBindings }>();

  app.get("/healthz", (c) => c.text("ok"));

  app.use("*", basicAuth);

  app.get("/", async (c) => {
    try {
      const entries = await listJsonl(c.env);
      return c.html(<HomePage entries={entries} />);
    } catch (err) {
      return c.html(
        <ErrorPage
          message={err instanceof Error ? err.message : String(err)}
          hint="Check R2 binding or STORAGE_* env vars on this service."
        />,
        500,
      );
    }
  });

  app.get("/session/:id", async (c) => {
    const key = decodeURIComponent(c.req.param("id"));
    try {
      const text = await getObjectText(c.env, key);
      const records = parseJsonl(text);
      const meta = sessionMeta(records);
      const turns = extractTurns(records);
      return c.html(
        <SessionPage objectKey={key} meta={meta} turns={turns} />,
      );
    } catch (err) {
      return c.html(
        <SessionErrorPage
          message={err instanceof Error ? err.message : String(err)}
        />,
        500,
      );
    }
  });

  return app;
}
