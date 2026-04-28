---
name: B8-ai-extensions
description: B7 拆分第 3 批（邀请发出后做）- 2 features：KOL 相似推荐 + 多语言 KOL 跨区匹配。embedding 解锁的全新功能，作为"产品在迭代"PMF 信号在邀请第 2 周上线。
status: decisions-locked
created_by: Kimi (Planner)
created_at: 2026-04-28
decisions_locked_at: 2026-04-28（用户 16:45 选 B 方案 3 批拆分）
estimated_effort: 3 day
prerequisites:
  - B7a-discovery-smart-match done（embedding pipeline 已就绪）
  - 邀请发出（~05-13）
trigger: 邀请发出后立即启动（PMF 信号"产品在持续迭代"）
---

# B8-ai-extensions — KOL 相似推荐 + 多语言匹配

## 1. 背景

B7 原 8 features 14-15 day → 用户 2026-04-28 16:45 选 B 方案拆 3 批：
- **B7a + B7b**（邀请前必做，6 features）：核心震撼 + placeholder 实装
- **B8**（本批次，邀请后做，2 features）：embedding 解锁的 R 方案新增亮点

**战略叙事：** 种子用户邀请发出第 1 周体验"完整 AI 产品"（震撼 + 基本可用），第 2 周看到"新功能上线"（KOL 相似推荐 + 跨语言搜索）= **"产品在持续迭代"PMF 信号**。

## 2. 范围（2 features，从 B7 spec §F007-F008 沿用）

| Feature | 来源 | 工时 |
|---|---|---|
| F001（原 B7 F007）KOL 相似推荐（详情页"找到下一个"） | docs/specs/B7-mvp-launch-ready-spec.md §F007 | ~2 day |
| F002（原 B7 F008）多语言 KOL 跨区匹配（中文 marketer 找日韩 KOL） | §F008 | ~1 day |

**注：** Feature ID 重新编号 F001-F002；spec 详细 acceptance 引用原 B7 spec 对应 §。

## 3. 与 B7a / B7b 关系

- **依赖 B7a F001 embedding pipeline**（已就绪）
- **依赖 B7b F004 i18n 框架**（自动 i18n:translate 4 语言）
- **不依赖 MVP-demo-launch**（demo 已发，B8 是邀请后增量）

## 4. 战略价值

- **PMF 信号**：邀请发出后第 2 周看到"新功能上线" = 产品在迭代
- **客户深度感知**：KOL 相似推荐 = 留存（类比 Spotify "找到下一个"）
- **差异化能力**：跨语言搜索 = 中文 game studio 客户的核心痛点

## 5. 时间线

```
~05-13      邀请发出 ⭐ MVP 上线
~05-13      ⭐ B8 building（2 features，3 day）
~05-16      B8 done + 用户 prod redeploy
~05-16      种子用户第 2 周看到 KOL 相似推荐 + 跨语言搜索
~05-22      第 2 周用户反馈收集（PMF 信号 + B8 真实使用率）
```

## 6. Acceptance 详细引用

详见 `docs/specs/B7-mvp-launch-ready-spec.md` §F007 / §F008，本批次 features.json 重新编号为 F001-F002 但 acceptance 内容一致。

## 7. 用户决策（2026-04-28 16:45 ✅ lock）

| # | 问题 | 用户答复 |
|---|---|---|
| 1 | B7 拆分方案 | ✅ B 方案（拆 3 批） |
| 2 | 本批次范围 | ✅ F007 + F008（KOL 相似 + 多语言） |
| 3 | 启动时机 | ✅ 邀请发出后立即（PMF 叙事价值） |

---

**Spec 状态：** decisions-locked，等邀请发出后启动
