// Cloudflare Workers entry — wrangler dev / wrangler deploy
import { createApp, type AppBindings } from "./app";

const app = createApp();

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<AppBindings>;
