// 本地协议自测：连接 stdio server，列出 tools，可选调用一个 tool。
// 用法: node test/smoke.mjs            只列 tools
//       node test/smoke.mjs <channel>  额外调用 find_outlier_videos
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const transport = new StdioClientTransport({ command: process.execPath, args: [path.join(HERE, "..", "src", "server.mjs")] });
const client = new Client({ name: "smoke", version: "1.0.0" }, { capabilities: {} });

await client.connect(transport);
const { tools } = await client.listTools();
console.log("TOOLS:", tools.map((t) => t.name).join(", "));

const ch = process.argv[2];
if (ch) {
  const r = await client.callTool({ name: "find_outlier_videos", arguments: { channel: ch, min_multiplier: 2, limit: 30 } });
  console.log("\nfind_outlier_videos:", r.content?.[0]?.text?.slice(0, 1200));
}
await client.close();
