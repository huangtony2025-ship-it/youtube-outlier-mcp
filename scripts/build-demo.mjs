// 拉真实数据出 demo 报告（等 YOUTUBE_API_KEY 到位后跑）
// 用法: node scripts/build-demo.mjs [outliersPerChannel=5]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveChannel, getChannelVideos, computeOutliers, apiKey } from "../src/yt.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJ = path.join(HERE, "..");
const seeds = JSON.parse(fs.readFileSync(path.join(HERE, "seeds.json"), "utf8"));
const perCh = Number(process.argv[2] || 5);
const date = new Date().toISOString().slice(0, 10);

if (!apiKey()) {
  console.error("缺 YOUTUBE_API_KEY（secrets.env 或环境变量）。");
  process.exit(1);
}

const lines = [`# YouTube Outlier — 真实数据样例 (${date})`, "", "> 数据源：YouTube Data API v3（公开数据）。multiplier 为本工具计算的衍生指标，非 YouTube 官方数据。", ""];

for (const handle of seeds.known_handles) {
  try {
    const ch = await resolveChannel(handle);
    const { videos } = await getChannelVideos(ch.id, { limit: 50 });
    const r = computeOutliers(videos, { minMultiplier: 2, minAgeDays: 7 });
    lines.push(`## ${ch.title} (${ch.handle || handle})`);
    lines.push(`- subs: ${ch.subscribers.toLocaleString()} · videos: ${ch.videoCount.toLocaleString()} · median views (last ${r.videoCount}): ${r.baselineMedianViews.toLocaleString()}`);
    if (!r.outliers.length) lines.push(`- (no 2× outlier in recent window)`);
    for (const o of r.outliers.slice(0, perCh)) {
      lines.push(`- **x${o.multiplier}** · ${o.views.toLocaleString()} views · ${o.ageDays}d · [${o.title}](https://www.youtube.com/watch?v=${o.id})`);
    }
    lines.push("");
    console.error(`ok ${handle} (${r.outliers.length} outliers)`);
  } catch (e) {
    lines.push(`## ${handle} — ERROR: ${e.message}`);
    lines.push("");
    console.error(`fail ${handle}: ${e.message}`);
  }
}

const out = path.join(PROJ, "landing", `demo-${date}.md`);
fs.writeFileSync(out, lines.join("\n"));
console.log("wrote", out);
