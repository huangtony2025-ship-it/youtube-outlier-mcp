#!/usr/bin/env node
// YouTube Outlier MCP Server (stdio) — Node 本地版
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools.mjs";
import * as yt from "./yt.mjs";

const server = new McpServer({ name: "youtube-outlier", version: "0.1.0" });
registerTools(server, yt);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[youtube-outlier-mcp] stdio ready");
