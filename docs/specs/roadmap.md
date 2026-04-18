# KOLMatrix 批次路线图（Roadmap）

> 版本：v1.0 · 日期：2026-04-18
> 目的：给 Planner / Generator / Evaluator 一份长期视野，知道 B0 之后会发生什么。
> 路线图 ≠ 不可变承诺，每个批次启动时 Planner 重新评估范围。

## 当前状态

- ✅ **B0-foundation** — 工程地基（脚手架 + DB + Auth + App Shell + Dashboard mock + 公共组件库）— johnsong 实施中，3/10 完成
- ⏳ **B1-kol-database** — 待启动（spec 已草稿）
- 📝 后续批次见下表，spec 按需起草

## 批次路线（B1 ~ B5）

每批次原则：**5-30 个 features，2-5 天工时，单一聚焦主题，可独立验收。**

| 批次 | 主题 | 主要交付 | 依赖 | 已就绪设计稿 |
|---|---|---|---|---|
| **B1** | KOL Database 生命周期 | 列表/详情/新增/编辑/CSV 导入/状态流转/标签/批量操作 | B0 | KOL Database, KOL Detail |
| **B2** | AI 评分 + 异步队列 | aigcgateway 接入 / BullMQ workers / KOL 评分管道 / 评分刷新调度 | B1, aigcgateway | （后台任务，无新页面） |
| **B3** | Campaigns 管理 | 列表/详情/创建/KOL 关联/进度/KPI 追踪 | B1 (KOL 已存在) | Campaigns 列表, Campaign 详情 |
| **B4** | 邮件触达系统 | 模板编辑 / Resend 接入 / 发送队列 / 频控 / 退订管理 | B3 (Campaign 已存在) | Email Center |
| **B5** | KOL Discovery (AI 匹配) | 全球 KOL 库种子（mock 800K） / 多维筛选 / AI 智能匹配建议 | B2 (AI 接入完成) | KOL Discovery |

## 批次后路线（B6+）

| 批次 | 主题 | 状态 |
|---|---|---|
| B6 | YouTube/TikTok 真实数据接入 + 缓存策略 | 设计稿待出 |
| B7 | 客户协同筛选（公开链接评分） | 设计稿待出 |
| B8 | 邮件追踪详情页 + Webhook 处理 | 设计稿待出 |
| B9 | Settings / Team management / DNS config | 设计稿待出 |
| B10 | 竞品分析 + 效果数据回流 | 远期 |
| B11 | Webhook & API 开放 | 远期 |

## 设计稿生成策略

每批次开工前必须保证：
1. 涉及的页面 Stitch 设计稿已生成（`design-draft/stitch-references/*.html` + `.png`）
2. 如有数据模型变更，先更新 `B0-database-schema.md` 或单独发新 schema spec
3. 如有架构变更（新增队列、新外部依赖等），更新 `architecture.md`

**当前已就绪设计稿（7 张 P0）：**
Dashboard / KOL Discovery / KOL Detail / Campaigns 列表 / Campaign 详情 / KOL Database / Email Center

**待生成设计稿（V4/V5 批次）：**
- V4: 产品知识库 + 客户协同筛选 + Email Tracking 详情
- V5: 登录 / 注册 / 设置 / 团队管理

## 风险与策略

| 风险 | 应对 |
|---|---|
| 单批次范围膨胀 | 每批次 ≤30 features；超出拆为子批次（B1a/B1b） |
| 设计稿与代码漂移 | 业务批次必须 update 设计稿（如 schema 变更影响 KOL 卡片字段） |
| AI 评分外部依赖卡壳 | B2 用 mock aigcgateway 先打通流程，再接真实服务 |
| 多 agent 并发冲突 | 业务批次 generator 一次只 1 人，Planner/Evaluator 并行 |

## 后续修订机制

- 路线图每完成一批次 + 用户反馈后由 Planner 修订
- 重大调整（新增整批次、删除主题）需用户确认
- 微调（调整顺序、范围微缩）Planner 自主修订
