export default {
  async fetch(request: Request, env: Record<string, any>, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok", env: env.ENV }), {
        headers: { "content-type": "application/json" }
      });
    }

    return new Response("NOIZYLAB Worker is running 🚀", {
      headers: { "content-type": "text/plain" }
    });
  }
};
