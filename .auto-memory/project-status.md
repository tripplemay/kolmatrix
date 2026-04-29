---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **B5-kol-data-enrichment** — status=building（2026-04-30 开工）
- 5 features：schema +4 字段 / YouTube enrich / Discovery filter +3 维折叠 / KOL 详情页改造（banner + 6 视频 + 完整版词云 react-wordcloud） / i18n + 守门 tests
- 估时 ~2.5-3.5 day Generator + Reviewer L1+L2

## 已 lock 决策（B5）
- A1 engagementRate：F002 仅估算/留空 → F004 lazy load 时写回真值
- A2 metadata 升级到列：不双写，新代码只写 schema 列
- 词云方案：c 完整版（react-wordcloud + d3-cloud + AI 提取关键词 weight 视觉化）
- 启动模式：B5 单独先做，B5 done 后再起 MVP-internal-demo-prep（A 方案）

## 下一批次（已 lock 决策，待 B5 done 启动）
- **MVP-internal-demo-prep** — status=decisions-locked, awaits B5 done
- 5 features：Dashboard 三元素 / Q5 Product zod 强制 / 5 款游戏 Products seed / 团队 README / Prod L2 烟测
- 完整 spec：`docs/specs/MVP-internal-demo-prep-spec.md`
- 关键决策：受众=团队内部 / 单 Demo Studio tenant 共用账号 / 不写 demo seed 脚本（零技术债）

## 角色分配（B5 沿用近 10 批次 convention）
- Planner: johnsong / Generator: johnsong / Evaluator: Reviewer

## 已完成签收批次（13 批）
B0 / BI1 / BI2 / BI3 / BAux1 / BI4 / BM1 / BM2 / MVP-vf-hotfix / MVP-i18n / MVP-kol-seed-redo / B6 / B7a / B7b / HOTFIX×2 / B4 / BIx-staging-automation

## 关键决策（详见 docs/adr/）
- ADR-001 Option α / ADR-002 技术栈最新版 / ADR-003 像素级还原
- ADR-007 多租户 RLS / ADR-009 aigcgateway / ADR-010 kolquest.com 品牌域

## Backlog 剩余（3 条 / deferred 或 low）
- BL-003 /en 裸路径 404（deferred）
- BL-011 /api/kols/[id] 路由统一（low refactor）
- BL-012 KOL crawler API sync（deferred Post-MVP M5 ~2026-06-25）

## MVP 路线
- 上线目标：~2026-05-07（B5 done + MVP-internal-demo-prep done + prod L2 PASS）
- 上线对象：团队内部其他岗位成员（产品 / 运营 / 设计）
- B8 KOL 相似 + 跨语言：邀请发出第 2 周（PMF 叙事，已 lock）

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
