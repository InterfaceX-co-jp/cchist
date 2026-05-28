import type { MiddlewareHandler } from "hono";

export type BasicAuthBindings = {
  BASIC_AUTH_USER?: string;
  BASIC_AUTH_PASS?: string;
};

export const basicAuth: MiddlewareHandler<{
  Bindings: BasicAuthBindings;
}> = async (c, next) => {
  const user = c.env.BASIC_AUTH_USER;
  const pass = c.env.BASIC_AUTH_PASS;

  // No credentials configured → viewer is public.
  if (!user || !pass) return next();

  const header = c.req.header("authorization");
  if (header?.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    const idx = decoded.indexOf(":");
    if (idx > 0) {
      const u = decoded.slice(0, idx);
      const p = decoded.slice(idx + 1);
      if (timingSafeEqual(u, user) && timingSafeEqual(p, pass)) {
        return next();
      }
    }
  }

  return new Response("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="cchist"' },
  });
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
