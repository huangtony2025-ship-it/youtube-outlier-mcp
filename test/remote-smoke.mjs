// 远程 MCP 自测（连 CF Worker）
// 用法: node test/remote-smoke.mjs [channel]
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const url = process.env.MCP_URL || "https://youtube-outlier-mcp.huangtony2025.workers.dev/mcp";
const transport = new StreamableHTTPClientTransport(new URL(url));
const client = new Client({ name: "remote-smoke", version: "1.0.0" }, { capabilities: {} });

await client.connect(transport);
const { tools } = await client.listTools();
console.log("REMOTE TOOLS:", tools.map((t) => t.name).join(", "));

const ch = process.argv[2] || "@Fireship";
const r = await client.callTool({ name: "find_outlier_videos", arguments: { channel: ch, min_multiplier: 3, limit: 30 } });
console.log("\nfind_outlier_videos(" + ch + "):");
console.log(r.content?.[0]?.text?.slice(0, 900));
await client.close();
