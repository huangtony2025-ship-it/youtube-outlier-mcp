# YouTube Outlier MCP

> Find **outlier videos** on any YouTube channel — videos that massively overperformed the channel's own median views. Reverse-engineer what topics/formats actually worked, instead of guessing.

Built for creators, growth teams, and channel researchers who use AI agents (Claude, Cursor, ChatGPT, opencode…).

## Tools

| Tool | What it does |
|---|---|
| `find_outlier_videos` ★ | Videos whose views are N× the channel's recent median. The killer feature. |
| `resolve_channel` | Channel overview: subs, total views, video count. |
| `get_channel_videos` | Recent videos with raw YouTube fields (views/likes/comments/duration). |
| `search_channels` | Find channels by keyword. |
| `get_trending` | YouTube most-popular by region. |

## Why outlier detection

A channel's **median** view count is its baseline. A 5× video tells you the format/topic that broken out. That's the signal worth copying — and it's invisible if you only look at raw view counts.

## Setup (stdio, local)

```jsonc
// Claude Desktop / Cursor / opencode mcp config
{
  "mcpServers": {
    "youtube-outlier": {
      "command": "node",
      "args": ["/absolute/path/to/mcp/youtube-outlier/src/server.mjs"],
      "env": { "YOUTUBE_API_KEY": "YOUR_KEY" }
    }
  }
}
```

Self-test:
```bash
npm install
node test/smoke.mjs                 # lists tools
node test/smoke.mjs @mkbhd          # runs find_outlier_videos
```

## Compliance (see COMPLIANCE.md)

- Public API data cached **≤ 30 days** (YouTube Developer Policies III.E.4.d).
- Derived metrics (multiplier/outlier) are **clearly marked as our own, not YouTube official**.
- This is a **tool**, not a resale of YouTube API access.
- Positioned as analysis software; no scraping; official API only.

## Status

- [x] Data layer (`src/yt.mjs`) — channels / videos / outliers / trending
- [x] MCP server (`src/server.mjs`, stdio, 5 tools)
- [x] Protocol smoke test
- [ ] Real-data run (blocked on YouTube API key → GCP 2SV)
- [ ] Remote deployment (HTTP transport)
- [ ] Product page + pricing
