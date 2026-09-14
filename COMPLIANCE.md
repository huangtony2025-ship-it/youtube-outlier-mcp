# YouTube API 合规红线（做本 MCP 前必读）

> 来源：YouTube API Services – Developer Policies（2026-09 实读原文）
> https://developers.google.com/youtube/terms/developer-policies

## 三条硬约束（决定我们的产品设计）

### 1. 不能"卖 YouTube 数据访问"
原文（III.G.1.b）：
> "sell YouTube API Services or access to any components of YouTube API Services unless you obtain YouTube's prior written approval"

→ **我们的定位必须是「工具/软件」，不是「数据转售」。**
→ 收费卖的是"分析功能（Software）"，不是"API 访问权"。Permitted Actions 明确允许 "Selling an API Client"。

### 2. 不能基于 API Data 造衍生指标（对我们的核心功能最痛）
原文（III.E.4.h）：
> "Your API Clients must not... (ii) access or use API Data to create new or derived data or metrics."
> 例："you are not permitted to use the number of likes returned in the API Data to calculate other metrics, such as ... a score that factors in likes, total views, or any other API Data."

→ **我们的 `find_outlier_videos`（views ÷ 频道中位数）属于"derived metric"，明文受限。**
→ 缓解措施（必做）：
   - 一切衍生指标（multiplier / outlier score）**必须显著标注**：
     "This metric is calculated by <product> and is NOT from YouTube."
   - 同时**原样展示 YouTube 原始字段**（viewCount / likeCount / publishedAt），不得替换。
   - 不得用衍生分冒充 YouTube 官方数据。

### 3. 公开数据缓存 ≤ 30 天
原文（III.E.4.d）：
> "API Clients may temporarily store limited amounts of Non-Authorized Data ... but not longer than 30 calendar days."

→ **缓存 TTL = 30 天，到期必须删除或刷新。**
（统计类 Authorized Data 可长存，但我们用的是公开数据 = Non-Authorized，30 天。）

## 其他必须遵守项
- **归属**：展示 YouTube 内容处必须显示 YouTube 品牌/来源（Branding Guidelines）。
- **隐私政策 + 条款**：产品必须有隐私政策，声明"使用 YouTube API Services"、链接 Google 隐私政策与 YouTube ToS。
- **禁止爬虫**：不得 scrape YouTube（只能走官方 API）。
- **禁止聚合**：不得跨 content owner 聚合 API Data。
- **配额**：超出默认配额需走 API Compliance Audit 申请；`search.list` 默认仅 100 次/天。
- **身份真实**：不得伪装身份/API Client。

## 结论（我们的合规姿势）
1. 定位 = **给创作者/增长团队的 YouTube 选题分析工具**（Software），不是数据 API 转售。
2. 衍生指标全部加"非 YouTube 官方"显著声明 + 旁边保留 YouTube 原始数字。
3. 缓存 30 天上限（代码里硬编码 TTL）。
4. 上线前必须有 privacy policy + ToS，且写明使用 YouTube API Services。
5. 保留随时配合 YouTube 整改/下架的能力（风险自担，风险等级：中）。
