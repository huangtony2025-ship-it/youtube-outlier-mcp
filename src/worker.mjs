// YouTube Outlier MCP Server — Cloudflare Workers 远程版（Streamable HTTP）
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createYt } from "./core.mjs";
import { registerTools } from "./tools.mjs";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type, mcp-session-id, mcp-protocol-version, authorization",
  "access-control-expose-headers": "mcp-session-id, mcp-protocol-version",
};

function buildServer(env) {
  const cache = {
    async get(k) {
      return await env.YT_CACHE.get(k, "json");
    },
    async set(k, v) {
      // 30 天 = ToS 上限（COMPLIANCE.md）
      await env.YT_CACHE.put(k, JSON.stringify(v), { expirationTtl: 2592000 });
    },
  };
  const yt = createYt({ apiKey: env.YOUTUBE_API_KEY, cache });
  const server = new McpServer({ name: "youtube-outlier", version: "0.1.0" });
  registerTools(server, yt);
  return server;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    if (url.pathname === "/" || url.pathname === "/health") {
      return Response.json(
        {
          ok: true,
          server: "youtube-outlier-mcp",
          version: "0.1.0",
          tools: ["resolve_channel", "get_channel_videos", "find_outlier_videos", "search_channels", "get_trending"],
          mcp: `${url.origin}/mcp`,
        },
        { headers: CORS }
      );
    }

    if (url.pathname !== "/mcp") return new Response("Not found. MCP endpoint: /mcp", { status: 404, headers: CORS });

    const server = buildServer(env);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
      enableJsonResponse: true,
    });
    await server.connect(transport);
    const res = await transport.handleRequest(request);
    const h = new Headers(res.headers);
    for (const [k, v] of Object.entries(CORS)) h.set(k, v);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
  },
};
