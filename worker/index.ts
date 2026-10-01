import * as lead from "../functions/api/lead";

export default {
  async fetch(request: Request, env: any, ctx: any) {
    const url = new URL(request.url);
    if (url.pathname === "/api/lead") {
      const handler = (lead as any).onRequestPost || (lead as any).onRequest;      if (request.method !== "POST" || !handler) {
        return new Response("Method not allowed", { status: 405 });
      }
      return handler({ request, env, ctx, waitUntil: ctx.waitUntil.bind(ctx) });
    }
    return env.ASSETS.fetch(request);
  },
};
