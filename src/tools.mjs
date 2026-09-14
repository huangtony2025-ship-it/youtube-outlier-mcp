// 共用 tool 注册（stdio / worker 两版复用）
import { z } from "zod";
import { computeOutliers, DISCLAIMER } from "./core.mjs";

const ok = (obj) => ({ content: [{ type: "text", text: typeof obj === "string" ? obj : JSON.stringify(obj, null, 2) }] });
const fail = (e) => ({ content: [{ type: "text", text: `Error: ${e?.message || e}` }], isError: true });

export function registerTools(server, yt) {
  server.registerTool(
    "resolve_channel",
    {
      title: "Resolve YouTube channel",
      description: "Get a YouTube channel overview: title, handle, subscribers, total views, video count. Accepts @handle, UC... channel id, or channel URL.",
      inputSchema: { channel: z.string().describe("@handle, UC... channel id, or full channel URL") },
    },
    async ({ channel }) => {
      try {
        return ok(await yt.resolveChannel(channel));
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "get_channel_videos",
    {
      title: "Get channel recent videos",
      description: "List a channel's most recent videos with raw YouTube fields (views, likes, comments, duration, publishedAt). Newest first.",
      inputSchema: { channel: z.string().describe("@handle, UC... channel id, or URL"), limit: z.number().int().min(1).max(200).optional().describe("how many recent videos (default 50)") },
    },
    async ({ channel, limit = 50 }) => {
      try {
        const { channel: ch, videos } = await yt.getChannelVideos(channel, { limit });
        return ok({ channel: { id: ch.id, title: ch.title }, count: videos.length, videos });
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "find_outlier_videos",
    {
      title: "Find channel outlier videos",
      description:
        "★ Find videos that overperformed vs the channel's own median views (outlier detection). Use it to reverse-engineer which topics/formats worked. Returns raw YouTube fields plus a derived multiplier (marked as non-YouTube data).",
      inputSchema: {
        channel: z.string().describe("@handle, UC... channel id, or URL"),
        min_multiplier: z.number().optional().describe("minimum view multiple vs channel median (default 2)"),
        limit: z.number().int().min(5).max(200).optional().describe("how many recent videos to analyze (default 50)"),
        min_age_days: z.number().int().min(0).max(365).optional().describe("ignore videos younger than N days to avoid low-view bias (default 7)"),
      },
    },
    async ({ channel, min_multiplier = 2, limit = 50, min_age_days = 7 }) => {
      try {
        const ch = await yt.resolveChannel(channel);
        const { videos } = await yt.getChannelVideos(ch.id, { limit });
        const r = computeOutliers(videos, { minMultiplier: min_multiplier, minAgeDays: min_age_days });
        return ok({
          channel: { id: ch.id, title: ch.title, handle: ch.handle, subscribers: ch.subscribers },
          baseline_median_views: r.baselineMedianViews,
          analyzed_videos: r.videoCount,
          threshold: min_multiplier,
          outliers: r.outliers.slice(0, 25),
          _disclaimer: DISCLAIMER,
        });
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "search_channels",
    {
      title: "Search YouTube channels",
      description: "Search YouTube channels by keyword. NOTE: the search endpoint has a separate low daily quota, so results are cached.",
      inputSchema: { query: z.string().describe("keyword, e.g. 'ai tools', 'faceless channel'"), max_results: z.number().int().min(1).max(25).optional().describe("default 10") },
    },
    async ({ query, max_results = 10 }) => {
      try {
        return ok({ query, channels: await yt.searchChannels(query, { maxResults: max_results }) });
      } catch (e) {
        return fail(e);
      }
    }
  );

  server.registerTool(
    "get_trending",
    {
      title: "Get YouTube trending",
      description: "Get YouTube's most-popular videos for a region (raw YouTube data).",
      inputSchema: { region_code: z.string().optional().describe("ISO country code, default US"), max_results: z.number().int().min(1).max(50).optional().describe("default 25") },
    },
    async ({ region_code = "US", max_results = 25 }) => {
      try {
        const v = await yt.getTrending({ regionCode: region_code, maxResults: max_results });
        return ok({ region: region_code, count: v.length, videos: v });
      } catch (e) {
        return fail(e);
      }
    }
  );
}
