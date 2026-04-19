# ADR-001: Option α Infra-First Sequencing

## Status

**Accepted**

- 日期：2026-04-19
- 作者：Kimi（Planner）+ 用户最终决策
- 相关批次：Roadmap 级（跨全部批次）

## Context

B0-foundation 启动后，Planner 起草了 BI1 测试基建 / BI2 部署自动化 / BI3 域名 TLS 三个基建批次 spec。同时 B1-B5 业务批次路线图也已就绪。

关键问题：**基建批次和业务批次的执行顺序**。三种候选方案：

1. **Option α（infra-first）**：B0 → BI1 → BI2 → BI3 → B1 → B2 → ...
2. **Option β（business-first）**：B0 → BI1（测试必须）→ B1 → B2 → B3 → BI2+BI3 → B4
3. **Option γ（渐进推进）**：B0 → BI1 → BI3.F001+F004（最小 HTTPS）→ B1 → BI2 + BI3 剩余 → B2+

**约束：**
- BI1 测试基建**必须**在 B1 之前（B1 acceptance 含 80% 覆盖率）
- BI3.F006 Mail DNS **必须**在 B4 之前（Resend 验证依赖）
- 首次 prod 部署需要 HTTPS（用户输密码的底线）
- 总工时预估：BI1 2-3d + BI2 1-2d + BI3 1d ≈ 5-6 天

## Decision

**采用 Option α：严格串行 infra-first。**

顺序：
```
B0 ──► BI1 ──► BI2 ──► BI3 ──► B1 ──► B2 ──► B3 ──► B4 ──► B5 ──► ...
       │       │       │      
       └────── 全部基建 ─────┘
```

全部基建批次（BI1 测试 / BI2 部署 / BI3 域名 TLS）在启动第一个业务批次 B1 之前完成。

## Consequences

### 正面

- **第一次 prod 部署时全套安全网就位：** HTTPS / 自动续期 / 健康检查 / 自动回滚 / DB 备份 / 测试覆盖 / CI 集成测试
- **业务批次无基建摩擦：** B1-B5 只需"写 features + 跑 tests + deploy"，不穿插基建任务
- **decision fatigue 减轻：** 基建与业务混合会频繁切换心智模式
- **质量地基夯实：** BI1 测试覆盖 B0 代码 → 为后续所有业务批次建立自动化回归防线

### 负面

- **首个业务功能交付推迟约 3-4 天：** 如果 B0 + BI1-3 用 6 天，B1 首批业务功能上线要到 Day 10+
- **对内 / 对外 demo 仍然用 B0 mock dashboard：** 期间如有临时演示需求，展示内容较单薄

### 中性

- BI4 监控 + Sentry 不在此顺序内（远期可选）
- 如首次部署时发现 BI2/BI3 有疏漏，可加 hotfix 批次补齐

## Alternatives Considered

### 方案 β（business-first, 已拒绝）

顺序：B0 → BI1 → B1 → B2 → B3 → [BI2+BI3] → B4 → B5

- **拒绝理由 1：** B1-B3 期间 localhost 跑，对内 demo 要录屏截图，体验差
- **拒绝理由 2：** BI2/BI3 拖到 B3 之后，遇到线上问题时无自动化 deploy / rollback，凌晨故障靠人工 SSH
- **拒绝理由 3：** 业务批次间穿插基建，心智切换成本高

### 方案 γ（渐进推进, 已拒绝）

B0 → BI1 → **BI3.F001+F004 只做生产 HTTPS**（1 天）→ B1 → BI2 + BI3 剩余 → ...

- **方案价值：** 平衡 infra 与业务进度，HTTPS 早落地
- **拒绝理由 1：** 需要拆 BI3 成子集，批次边界模糊，harness 状态机不支持
- **拒绝理由 2：** 部分基建完成状态下启动 B1，后续基建批次要回头改代码（如加 health endpoint）
- **拒绝理由 3：** 用户明确偏好"一次把 infra 做好"（strict serial）

## References

- **Commits：** `1edf07e`（Option α 锁定）
- **Spec：** `docs/specs/roadmap.md` v2.0 §执行顺序
- **相关 ADR：** ADR-008（严格验收模式依赖此顺序）
- **讨论背景：** 会话中 3 种方案对比表（α/β/γ）

## Notes

### 重新评估触发条件

如果以下情况出现，应重新评估此 ADR：

1. 用户商业压力要求提前交付 B1（推翻 Option α）
2. BI1 测试基建真实工时远超预估（如 > 5 天）
3. BI2/BI3 遇到不可控阻塞（如域名 DNS 供应商问题）
4. 发现 BI 批次之间可并行化（如第二个 Generator 到位）

### 执行锚点

roadmap.md v2.0 头部已绘制明确 ASCII 流程图 + "决策依据" 段落，防止后续 agent 误解顺序。
