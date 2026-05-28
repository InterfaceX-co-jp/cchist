// Node entry — Railway / local dev
//
// Loads env vars via process.env and serves static assets from ./public.
// R2 binding is unavailable here → storage layer falls back to @aws-sdk/client-s3.

import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createApp, type AppBindings } from "./app";

const app = createApp();

// Serve Tailwind CSS bundle and any other static files from ./public
app.use("/styles.css", serveStatic({ path: "./public/styles.css" }));
app.use("/static/*", serveStatic({ root: "./public" }));

const env: AppBindings = {
  STORAGE_ENDPOINT: process.env.STORAGE_ENDPOINT,
  STORAGE_REGION: process.env.STORAGE_REGION,
  STORAGE_BUCKET: process.env.STORAGE_BUCKET,
  STORAGE_ACCESS_KEY: process.env.STORAGE_ACCESS_KEY,
  STORAGE_SECRET_KEY: process.env.STORAGE_SECRET_KEY,
  STORAGE_PREFIX: process.env.STORAGE_PREFIX,
  BASIC_AUTH_USER: process.env.BASIC_AUTH_USER,
  BASIC_AUTH_PASS: process.env.BASIC_AUTH_PASS,
};

const port = Number(process.env.PORT ?? 3000);

serve(
  {
    fetch: (req) => app.fetch(req, env),
    port,
  },
  (info) => {
    console.log(`cchist-web listening on http://localhost:${info.port}`);
  },
);
