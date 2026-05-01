---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **MVP-internal-demo-prep** — building 4/7（F002/F003/F004/F007 done；F006 in-progress；F001 + F005 codex pending）
- 估时 ~3 day Generator + 0.5 day Reviewer；目标 ~05-05 团队内部 demo
## 已完成 commits（main HEAD = f1abf1f）
- 205aa4c F002 Q5 zod / d7e9746 F007 文案 polish / fe151f5 F002 test fix
- 2b95569 F004 README / a7fd12d F003 5 Products seed + post-F002/F007 test fixes
- 3450a9d visual baseline 重生
## 关键设计决策（spec §3 lock）
- 受众=团队内部；Tenant=Demo Studio 共用现有账号；不写 demo:seed；CPI=hardcoded+角标
- 5 款游戏=Honor of Kings/Genshin/PUBG Mobile/Pokemon Go/Clash Royale；aiAssets=3 预生成+2 null
- 登录页文案 5 keys 改值 + 删 chipStudios/trustedBy（用户 4 轮 lock）
## 2026-05-01 三次决议（前端审计后续）
- (γ) F005 = CR-4/5/6 + H-P1/2/3 六件套并入 BIx；H-P4 进 BL-021；H-P5 进 BL-022
- (γ-2) CR-1/2/3 + H-S1/2/3 安全 Critical/High 合 BL-020 mini-batch（不进 BIx）
- next/font 自托管 Material Symbols 子集（保留视觉，lucide-react 单独 M-P8 卸载）
- CSP Report-Only 一周观察期 → 下批次切 enforce
## B5 done 收尾未完项
- framework/proposed-learnings.md 当前空；本批次 done 时 Planner 一并提交 9+ 条候选（B5 7 轮 fixing 经验：deploy runbook prisma migrate 漏 / enrich 漏 / PM2 env_file 不重读 / aigcgateway action shape drift / timeout 5s 紧 / SHA 对齐 / Prisma Json cast / @visx alpha types / visual baseline GITHUB_TOKEN 不触发下游）
## 即将启动批次（按序）
- **BIx-mvp-polish-pass** (5 features ~5-5.5 day Generator + 0.5 day Reviewer) — `docs/specs/BIx-mvp-polish-pass-spec.md`（2026-05-01 加 F005 perf 六件套）
- **BL-020 mini-batch** 安全整改 ~0.5-1 day（BIx done + 团队 demo 反馈窗口期内启动；上线对外客户前必须落地）
## 角色分配
- 默认映射（role_assignments=null）：CLI = planner+generator，Codex = evaluator
## Backlog 12 条
BL-003/011/012/014~019（9 旧）+ BL-020 安全 high / BL-021 Suspense medium / BL-022 列表虚拟化 deferred
## MVP 上线时间线
- ~05-05 MVP-internal-demo-prep done → 团队内部 demo
- ~05-12 BIx-mvp-polish-pass done（原 ~05-10，+F005 推 2 天）
- ~05-13 BL-020 安全整改 mini-batch done → 上线对外客户准备就绪

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
