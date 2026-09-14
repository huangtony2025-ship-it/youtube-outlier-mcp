// YouTube Outlier — 纯逻辑层（无 node 依赖，Node 与 CF Workers 共用）
// 合规（COMPLIANCE.md）：缓存 TTL ≤30 天；衍生指标标注非 YouTube 官方；不转售 API。
export const API = "https://www.googleapis.com/youtube/v3";
export const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // ToS 硬上限，不可调大
export const DISCLAIMER = "multiplier/outlier values are derived metrics computed by this tool, not YouTube official data.";

// ---------- 纯算法 ----------
export const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};
export const daysSince = (iso) => (Date.now() - new Date(iso).getTime()) / 86400000;

export function computeOutliers(videos, { minMultiplier = 2, minAgeDays = 7 } = {}) {
  const pool = videos.filter((v) => daysSince(v.publishedAt) >= minAgeDays);
  const views = pool.map((v) => v.views).filter((n) => n > 0);
  const base = median(views);
  const rows = pool
    .map((v) => ({ ...v, ageDays: Math.round(daysSince(v.publishedAt)), multiplier: base ? Math.round((v.views / base) * 10) / 10 : 0 }))
    .sort((a, b) => b.multiplier - a.multiplier);
  return {
    baselineMedianViews: base,
    videoCount: pool.length,
    _note: DISCLAIMER,
    outliers: rows.filter((r) => r.multiplier >= minMultiplier),
    all: rows.slice(0, 50),
  };
}

// ---------- 工厂：注入 apiKey + cache(异步) + fetch ----------
export function createYt({ apiKey, cache, fetchImpl = fetch }) {
  const getC = async (k) => (cache ? cache.get(k) : null);
  const setC = async (k, v) => (cache ? cache.set(k, v) : undefined);

  async function ytApi(endpoint, params = {}, { useCache = true } = {}) {
    if (!apiKey) throw new Error("缺少 YOUTUBE_API_KEY");
    const qs = new URLSearchParams({ ...params, key: apiKey }).toString();
    const ck = `${endpoint}?${qs.replace(apiKey, "KEY")}`;
    if (useCache) {
      const hit = await getC(ck);
      if (hit) return hit;
    }
    const res = await fetchImpl(`${API}/${endpoint}?${qs}`);
    const j = await res.json();
    if (!res.ok) throw new Error(`YouTube API ${endpoint}: ${j?.error?.message || "HTTP " + res.status}`);
    if (useCache) await setC(ck, j);
    return j;
  }

  async function resolveChannel(ref) {
    let id = String(ref), handle = null;
    const m = id.match(/\/channel\/(UC[\w-]+)/);
    const h = id.match(/\/?(@[\w.-]+)/);
    if (m) id = m[1];
    else if (h && !id.startsWith("UC")) handle = h[1];
    const params = { part: "snippet,statistics,contentDetails" };
    if (handle) params.forHandle = handle;
    else params.id = id;
    const j = await ytApi("channels", params);
    const it = j.items?.[0];
    if (!it) throw new Error(`找不到频道: ${ref}`);
    return {
      id: it.id,
      title: it.snippet.title,
      handle: it.snippet.customUrl || "",
      description: (it.snippet.description || "").slice(0, 300),
      country: it.snippet.country || "",
      publishedAt: it.snippet.publishedAt,
      subscribers: Number(it.statistics.subscriberCount || 0),
      totalViews: Number(it.statistics.viewCount || 0),
      videoCount: Number(it.statistics.videoCount || 0),
      uploadsPlaylist: it.contentDetails?.relatedPlaylists?.uploads || "",
      url: `https://www.youtube.com/channel/${it.id}`,
    };
  }

  async function getChannelVideos(channel, { limit = 50 } = {}) {
    const ch = channel.startsWith("UC") && channel.length > 20 ? await resolveChannel(channel) : await resolveChannel(channel);
    const ids = [];
    let pageToken = "";
    while (ids.length < limit) {
      const j = await ytApi("playlistItems", {
        part: "contentDetails",
        playlistId: ch.uploadsPlaylist,
        maxResults: String(Math.min(50, limit - ids.length)),
        ...(pageToken ? { pageToken } : {}),
      });
      for (const it of j.items || []) ids.push(it.contentDetails.videoId);
      pageToken = j.nextPageToken || "";
      if (!pageToken) break;
    }
    const out = [];
    for (let i = 0; i < ids.length; i += 50) {
      const j = await ytApi("videos", { part: "snippet,statistics,contentDetails", id: ids.slice(i, i + 50).join(",") });
      for (const v of j.items || []) {
        out.push({
          id: v.id,
          title: v.snippet.title,
          publishedAt: v.snippet.publishedAt,
          duration: v.contentDetails?.duration || "",
          views: Number(v.statistics?.viewCount || 0),
          likes: Number(v.statistics?.likeCount || 0),
          comments: Number(v.statistics?.commentCount || 0),
          url: `https://www.youtube.com/watch?v=${v.id}`,
        });
      }
    }
    return { channel: ch, videos: out };
  }

  async function searchChannels(query, { maxResults = 10 } = {}) {
    const j = await ytApi("search", { part: "snippet", type: "channel", q: query, maxResults: String(Math.min(50, maxResults)) });
    const ids = (j.items || []).map((it) => it.id.channelId).filter(Boolean);
    if (!ids.length) return [];
    const d = await ytApi("channels", { part: "snippet,statistics", id: ids.join(",") });
    const map = Object.fromEntries((d.items || []).map((c) => [c.id, c]));
    return ids
      .map((id) => {
        const c = map[id];
        if (!c) return null;
        return { id, title: c.snippet.title, handle: c.snippet.customUrl || "", subscribers: Number(c.statistics.subscriberCount || 0), videoCount: Number(c.statistics.videoCount || 0), url: `https://www.youtube.com/channel/${id}` };
      })
      .filter(Boolean);
  }

  async function getTrending({ regionCode = "US", maxResults = 25, categoryId } = {}) {
    const j = await ytApi("videos", { part: "snippet,statistics", chart: "mostPopular", regionCode, maxResults: String(Math.min(50, maxResults)), ...(categoryId ? { videoCategoryId: String(categoryId) } : {}) });
    return (j.items || []).map((v) => ({ id: v.id, title: v.snippet.title, channelTitle: v.snippet.channelTitle, channelId: v.snippet.channelId, publishedAt: v.snippet.publishedAt, views: Number(v.statistics?.viewCount || 0), url: `https://www.youtube.com/watch?v=${v.id}` }));
  }

  return { ytApi, resolveChannel, getChannelVideos, searchChannels, getTrending };
}
