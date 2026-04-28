---
name: B7b-placeholder-and-ai-aux
description: B7 拆分第 2 批 - 4 features：placeholder 实装 + AI 辅助 Insights/Suggestions + filter/Save Search + 全量 Polish/i18n/守门
status: decisions-locked
created_by: Kimi (Planner)
created_at: 2026-04-28
decisions_locked_at: 2026-04-28（用户 16:45 选 B 方案 3 批拆分）
estimated_effort: 7-8 day
prerequisites:
  - B7a-discovery-smart-match done（embedding pipeline 已就绪）
trigger: B7a done 后立即启动
---

# B7b-placeholder-and-ai-aux — Placeholder 实装 + AI 辅助

## 1. 背景

B7 原 8 features 14-15 day → 用户 2026-04-28 16:45 选 B 方案拆 3 批：
- **B7a**（已启动，2 features）：F001 Embedding pipeline + F002 /discovery Smart Match（核心震撼）
- **B7b**（本批次，4 features）：placeholder 实装 + AI 辅助 + 全量 polish
- **B8-ai-extensions**（邀请后启动，2 features）：F007 KOL 相似推荐 + F008 多语言匹配

## 2. 范围（4 features，从 B7 spec §F003-F006 沿用）

| Feature | 来源 | 工时 |
|---|---|---|
| F001（原 B7 F003）/database AI Intelligence + Coverage Gap | docs/specs/B7-mvp-launch-ready-spec.md §F003 | ~2-3 day |
| F002（原 B7 F004）/campaigns/:id AI Suggestions | §F004 | ~2 day |
| F003（原 B7 F005）Tier+Game filter + Save Search | §F005 | ~2 day |
| F004（原 B7 F006）Polish + tests + spec 链 + i18n（4 语言）+ 守门 | §F006 | ~2 day |

**注：** Feature ID 在本批次重新编号 F001-F004（features.json 内）；spec 详细 acceptance 引用原 B7 spec 对应 §。

## 3. 与 B7a 关系

- **不依赖 B7a 数据**（F001-F004 都不调 embedding）
- **依赖 B7a 完成**（B7a done 后切 sprint，避免单线冲突）
- **i18n 统一处理**：B7a 仅补 en+zh，B7b F004 跑 i18n:translate 补 ja/ko/es

## 4. 时间线

```
~04-28      B7a 启动（2 features）
~05-01      B7a done
~05-01      B7b building（4 features，7-8 day）
~05-08      B7b done
~05-08      MVP-demo-launch 合并 sprint building（5-6 day）
~05-13      done + 邀请发出 ⭐
```

## 5. Acceptance 详细引用

详见 `docs/specs/B7-mvp-launch-ready-spec.md` §F003 / §F004 / §F005 / §F006，本批次 features.json 重新编号为 F001-F004 但 acceptance 内容一致。

**🆕 staging deployed 模板（2026-04-28 lock，每 feature 强制含）：**
- `staging git_sha 与本 commit 一致（curl https://staging.kol.guangai.ai/api/health | jq .git_sha 验证）`

详见 `.auto-memory/role-context/generator.md` §"切 verifying 前的 staging deploy 硬要求" + §"features.json acceptance 模板"。

## 6. 用户决策（2026-04-28 16:45 ✅ lock）

| # | 问题 | 用户答复 |
|---|---|---|
| 1 | B7 拆分方案 | ✅ B 方案（拆 3 批） |
| 2 | 本批次范围 | ✅ F003-F006（placeholder + ai-aux） |

---

**Spec 状态：** decisions-locked，等 B7a done 后启动
