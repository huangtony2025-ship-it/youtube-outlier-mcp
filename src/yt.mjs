// YouTube Outlier — Node 适配层（fs 缓存 + CLI）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createYt, computeOutliers, CACHE_TTL_MS } from "./core.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJ = path.join(HERE, "..");
const CACHE_DIR = path.join(PROJ, ".cache");

export { computeOutliers, CACHE_TTL_MS };

// ---- secrets ----
let _key = null;
export function apiKey() {
  if (_key !== null) return _key;
  if (process.env.YOUTUBE_API_KEY) return (_key = process.env.YOUTUBE_API_KEY.trim());
  let dir = PROJ;
  for (let i = 0; i < 6; i++) {
    const p = path.join(dir, "secrets.env");
    if (fs.existsSync(p)) {
      for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (m && m[1] === "YOUTUBE_API_KEY") return (_key = m[2].replace(/^["']|["']$/g, "").trim());
      }
    }
    dir = path.dirname(dir);
  }
  return (_key = "");
}

// ---- fs 缓存（30 天上限）----
const cachePath = (k) => path.join(CACHE_DIR, k.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 120) + ".json");
const nodeCache = {
  async get(k) {
    try {
      const p = cachePath(k);
      if (!fs.existsSync(p)) return null;
      const { t, v } = JSON.parse(fs.readFileSync(p, "utf8"));
      if (Date.now() - t > CACHE_TTL_MS) {
        fs.unlinkSync(p);
        return null;
      }
      return v;
    } catch {
      return null;
    }
  },
  async set(k, v) {
    try {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      fs.writeFileSync(cachePath(k), JSON.stringify({ t: Date.now(), v }));
    } catch {}
  },
};

export const { resolveChannel, getChannelVideos, searchChannels, getTrending, ytApi } = createYt({ apiKey: apiKey(), cache: nodeCache });

// ---- CLI: node src/yt.mjs <@handle|UC...|url> [minMultiplier] ----
if (process.argv[1]?.endsWith("yt.mjs")) {
  const arg = process.argv[2];
  if (!arg) {
    console.log("用法: node src/yt.mjs <@handle|UC...|url> [minMultiplier]");
    console.log("key:", apiKey() ? "已加载" : "缺失(YOUTUBE_API_KEY)");
    process.exit(0);
  }
  const minMul = Number(process.argv[3] || 2);
  const ch = await resolveChannel(arg);
  const { videos } = await getChannelVideos(ch.id, { limit: 50 });
  const r = computeOutliers(videos, { minMultiplier: minMul });
  console.log(`\n频道: ${ch.title} (${ch.handle})  订阅 ${ch.subscribers.toLocaleString()}  视频 ${ch.videoCount}`);
  console.log(`基准(近期 ${r.videoCount} 条中位播放): ${r.baselineMedianViews.toLocaleString()}  阈值 x${minMul}`);
  console.log(`\n异常爆款 TOP:`);
  for (const o of r.outliers.slice(0, 12)) console.log(`  x${o.multiplier}\t${o.views.toLocaleString()} views\t${o.ageDays}d\t${o.title.slice(0, 60)}`);
}
