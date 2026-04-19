# 架构决策记录（Architecture Decision Records）

> KOLMatrix 项目所有**跨批次影响 / 不可逆 / 当时有过辩论**的关键决策记录。
> 建立日期：2026-04-19（B0 完成后回溯 8 份决策）

## 什么时候该写 ADR

**写：**
- 决策影响多个批次
- 反转需要返工（不可逆或成本高）
- 当时讨论过多个方案
- 会影响未来新 agent 的判断
- 技术栈 / 架构 / 流程 / 验收口径

**不写：**
- 一次性实现细节（库选型：如"用 recharts"—— 换一个不影响架构）
- Spec 级细节（功能列表 / 字段定义 —— 在 spec 里）
- 个人偏好（commit 格式 / 命名风格 —— 在 CLAUDE.md）
- Bug 修复（没决策，只有修复）

## 如何使用

### 新 agent 上手
1. 读本 README 1 分钟，看决策总览
2. 按主题 / 按时间挑选 2-3 份 ADR 深读

### 做新决策前
1. 检查本索引是否已有相关 ADR
2. 读相关 ADR 确认新决策不冲突
3. 如果冲突：新 ADR 标 `Supersedes ADR-XXX`，同时改旧 ADR 状态为 `Superseded by ADR-YYY`

### 遇规格争议
1. 先查 ADR（很多争议本质是历史决策被忽略）
2. ADR 无记录 → 按 `framework/harness/pre-impl-adjudication.md` 流程发审计请求

## 决策状态流转

```
Proposed ──► Accepted ──► [Deprecated | Superseded by ADR-YYY]
```

- **Proposed：** 提议中，未生效
- **Accepted：** 当前生效（默认状态）
- **Deprecated：** 不再适用，但无替代方案
- **Superseded：** 被更新的 ADR 取代

## 编号约定

- 3 位数字（001, 002, ..., 099, 100, 101, ...）
- 新 ADR 取下一个未用编号
- 被弃用的 ADR **编号保留不删**（ADR-005 永远是 ADR-005，不重新利用）

---

## 已接受的决策（按编号）

| # | 标题 | 一行摘要 | 状态 | 日期 |
|---|---|---|---|---|
| [001](./ADR-001-option-alpha-infra-first.md) | Option α Infra-First Sequencing | B0→BI1→BI2→BI3→B1 串行，infra 全完再启动业务 | Accepted | 2026-04-19 |
| [002](./ADR-002-tech-stack-latest-greenfield.md) | Tech Stack Latest Greenfield | Next.js 16 + React 19.2 + Tailwind v4 CSS-first + Prisma 7 | Accepted | 2026-04-19 |
| [003](./ADR-003-pixel-perfect-visual-standard.md) | Pixel-Perfect Visual Standard | 视觉验收 ±2px / ΔE<2 / 字号 100% / 布局 100% | Accepted | 2026-04-18 |
| [004](./ADR-004-f010-component-library-lock.md) | F010 Component Library Lock (12) | 硬锁 12 个公共组件，页面专属放 features/ | Accepted | 2026-04-18 |
| [005](./ADR-005-f007-component-adoption-criteria.md) | F007 §11.2 组件接入口径 | direct ≥5 + render tree 12 全覆盖 + 不 inline | Accepted | 2026-04-19 |
| [006](./ADR-006-pre-impl-audit-pattern.md) | Pre-Impl Audit → Planner Adjudication | Generator 主动审计 + Planner 裁决后开工 | Accepted | 2026-04-19 |
| [007](./ADR-007-multi-tenant-rls-strategy.md) | Multi-Tenant RLS Strategy | 共享 DB + PostgreSQL RLS + tenant_id current_setting | Accepted | 2026-04-18 |
| [008](./ADR-008-strict-manual-verification-mode.md) | Strict Manual Verification Mode | BI1 前 B0 用严格手工替代自动化测试 | Accepted | 2026-04-19 |

## 按主题索引

### 工程流程
- [ADR-001](./ADR-001-option-alpha-infra-first.md) 批次顺序
- [ADR-006](./ADR-006-pre-impl-audit-pattern.md) 开工前审计
- [ADR-008](./ADR-008-strict-manual-verification-mode.md) 验收模式

### 技术栈
- [ADR-002](./ADR-002-tech-stack-latest-greenfield.md) 框架选择

### 视觉 / UI
- [ADR-003](./ADR-003-pixel-perfect-visual-standard.md) 视觉还原标准
- [ADR-004](./ADR-004-f010-component-library-lock.md) 组件库锁定
- [ADR-005](./ADR-005-f007-component-adoption-criteria.md) 组件使用口径

### 数据与安全
- [ADR-007](./ADR-007-multi-tenant-rls-strategy.md) 多租户隔离

---

## 贡献 ADR

1. 复制 `000-template.md` 为 `ADR-XXX-kebab-title.md`
2. 按模板填写
3. 更新本 README 的两个表（编号索引 + 主题索引）
4. push commit message 用 `docs(adr): ADR-XXX 标题`

## 相关文档

- `framework/harness/pre-impl-adjudication.md` — 决策流程与裁决机制
- `.auto-memory/MEMORY.md` T2 条目 —— 本索引的记忆系统接入点
- `docs/specs/roadmap.md` —— 批次路线图（被 ADR-001 指导）
