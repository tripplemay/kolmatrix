# ADR-006: Pre-Implementation Audit → Planner Adjudication Pattern

## Status

**Accepted**

- 日期：2026-04-19
- 作者：johnsong（实践发起）+ Kimi（规范化）+ 用户（确认沉淀到框架）
- 相关批次：B0-foundation（源头实测）/ 所有后续批次（应用）

## Context

B0-foundation 启动后，johnsong 在实现 F005 App Shell 前发现规格内部冲突：
- `design-draft/` 下 7 份 Stitch HTML 的 Sidebar/Topbar 互不一致
- `progress.json` 提到 "Kimi 曾通过 edit_screens 回填 canonical"，但本地 HTML 快照仍是漂移版本
- 缺少 canonical 仲裁时硬开工会导致下一个 B1 页面视觉对不上又返工

johnsong 按 harness-rules "规格偏差开工前反馈" 条款，**主动提交 pre-impl 审计文档**：
- 11 条 canonical 裁决请求（A/B 方案 + 自己建议）
- 4 个 HTML bug（要不要回修源）
- 1 个 User Chip 方向确认

Kimi 裁决后推 main，johnsong 拉代码按决议实现。**0 返工。**

随后 F010 / F007 / F006 重复此流程。B0 sprint 共 4 次审计 × 25 决策点。

关键问题：**这种"Generator 开工前审计 + Planner 裁决"的模式是否值得沉淀为框架能力**？

## Decision

**采用 Pre-Implementation Audit → Planner Adjudication 模式，沉淀为 framework v0.9.0。**

**核心流程：**
```
Generator 发现规格歧义
    ↓ 按 framework/harness/pre-impl-adjudication.md §2.2 模板
写审计文档到 docs/specs/{batch}-{feature}-*.md
    ↓ push main，commit 明示"等 Planner 裁决"
Planner 读审计 → 在同文档末尾追加裁决段
    ↓ 同步修订相关 spec / features.json / test-cases
push main
    ↓ Generator 拉代码按决议开工
正式实现（0 building 返工风险）
```

**触发条件（Generator 必须提交审计）：**
1. spec 文字含糊
2. 多份参考源冲突
3. 组件 API 需要决策
4. 跨页变体
5. 非 token 色使用
6. 发现原型 bug
7. 数据模型 gap

**无需审计：** 简单 feature 无歧义（加 button / 修文案）。"**复杂度匹配风险**"。

**Planner 规则（P1-P5）：**
- P1 优先裁决
- P2 裁决完整（含理由 + 修订文件清单）
- P3 修 acceptance 必须 grep 扫全文消除矛盾
- P4 涉及验收口径的裁决必须同步更新 test-cases
- P5 裁决理由必须具备复用价值

详见 `framework/harness/pre-impl-adjudication.md`。

## Consequences

### 正面

- **0 building 阶段返工**（B0 实测 25 决策点全通过）
- **规格质量提升：** 审计过程强制 Planner 修订 spec 消除歧义
- **决策追溯：** 裁决追加在审计文档末尾，自然形成可追溯链条
- **新 agent 友好：** 新 Planner / Generator 看过历史审计能理解决策理由
- **模式可复用：** 任何项目使用 Triad Workflow 都能用此模式
- **Generator 自我保护：** 不用凭本能填空 spec 灰色地带

### 负面

- **审计→裁决延迟：** 每次审计需要 Planner 响应（B0 实测均延迟 ~1.5h）
- **审计过度风险：** 简单 feature 也写长 audit 文档浪费时间
- **Planner 负担：** Planner 需要随时响应审计请求（P1 规则）
- **沉淀成本：** 创建详细 audit doc 需要 30 min - 2h 不等

### 中性

- Reviewer 验收时可以参考 audit 决议理由判断 Generator 实现是否合规
- 审计文档属于一次性产物（不需要持续维护，裁决后就是历史）
- "复杂度匹配风险" 的判断由 Generator 自主，偶尔可能走眼

## Alternatives Considered

### 方案 A（纯 spec-driven 开工，已拒绝）

Generator 严格按 spec 实现，遇歧义自主解释。不需要 pre-impl 审计。

- **拒绝理由 1：** B0 实测 25 决策点如果 Generator 自主解释，保守估计 5-10 次 fixing 轮次
- **拒绝理由 2：** Reviewer 按不同解释可能判 fail，产生验收口径争议（F007 已发生一次即便有审计）
- **拒绝理由 3：** 规格质量问题被掩盖，不会修 spec

### 方案 C（强制每 feature 都审计，已拒绝）

不区分简单 / 复杂，每个 feature 开工前都写 audit。

- **拒绝理由 1：** 简单 feature 的 audit 文档 5 分钟能写完，但 overhead 显著（Planner 要逐个回复）
- **拒绝理由 2：** 会稀释审计的信号价值（复杂 feature 与简单 feature 的 audit 混在一起，Planner 难以优先级排序）
- **拒绝理由 3：** 违反"复杂度匹配风险"原则

## References

- **Commits：** 
  - `c28a602`（framework v0.9.0 pattern 沉淀）
  - `38e3c22`（F005 首次 pre-impl 裁决）
  - `e5f3229`（F010 pre-impl 裁决）
  - `2937c28`（F007 pre-impl 裁决）
  - `f2b2872`（F006 pre-impl 裁决）
- **权威文档：** 
  - `framework/harness/pre-impl-adjudication.md` —— pattern 完整定义（370 行）
  - `framework/harness/planner.md` §Planner 裁决职责（P1-P5 规则）
  - `framework/harness/generator.md` §2.5 开工前审计
  - `framework/CHANGELOG.md` v0.9.0
- **实测案例（B0 sprint 4 份审计）：**
  - `docs/specs/B0-app-shell-canonical-review.md` —— F005
  - `docs/specs/B0-f010-component-map.md` —— F010
  - `docs/specs/B0-f007-dashboard-plan.md` —— F007
  - `docs/specs/B0-f006-i18n-plan.md` —— F006
- **相关 ADR：** ADR-005（F007 口径本身就是审计产物）

## Notes

### B0 实测数据（验证 pattern 有效性）

| 指标 | 实测值 | 目标值 |
|---|---|---|
| 审计次数 | 4 | — |
| 决策点总数 | 25 | — |
| building 返工次数 | **0** | 0 |
| signoff 争议次数 | 1（F007 口径，根因是 Planner 修 spec 不彻底） | < 2 |
| 均延迟（push 审计 → push 裁决） | ~1.5 小时 | < 2 小时（同步） / < 半天（异步） |

### 与其他 harness 机制的关系

- 不违反铁律 6（Generator 不得执行 codex 任务）
- 不违反铁律 9（hotfix 也走流程）—— 紧急情况可缩略 audit 格式
- 强化 Planner 铁律 1（spec 涉及代码必须核查源码）—— 审计时 Planner 需 Read 相关文件

### 重新评估触发条件

- 如果 3 个 sprint 之后 audit 命中率仍保持 2+/sprint，说明 spec 质量需要系统性提升（而非依赖 audit 兜底）
- 如果 audit→裁决延迟频繁超 4 小时，考虑加 Planner（team 扩容）
- 如果发现某类决策总是走 audit（如视觉 canonical），考虑写成 playbook 预防性解决

### Cross-Project Applicability

模式沉淀在 `framework/` 意味着其他项目 bootstrap 时会自动带此能力。KOLMatrix 是 pattern 的**诞生地**，不是唯一受益者。
