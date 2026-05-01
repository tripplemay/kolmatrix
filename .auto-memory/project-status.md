---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **MVP-internal-demo-prep** — building 0/7（2026-05-01 启动；B5 已 done + signoff PASS + prod redeploy 完成）
- 估时 ~3 day Generator + 0.5 day Reviewer；目标 ~05-05 团队内部 demo
## Features
- F001 Dashboard 三元素 / F002 Q5 zod / F003 5 Products seed / F004 团队 README
- F005 Prod L2 烟测 (codex) / F006 Dashboard 真数据替 mock / F007 文案 polish (登录页重写)
## Generator 开工建议顺序（依赖最小化）
F002 → F007 → F004 → F003 → F006 → F001 → 全部 push CI 全绿 → SSH staging deploy + db:seed → 浏览器走查 → prod redeploy + db:seed → verifying 移交 Reviewer
## 关键设计决策（spec §3 lock）
- 受众=团队内部；Tenant=Demo Studio 共用现有账号；不写 demo:seed；CPI=hardcoded+角标
- 5 款游戏=Honor of Kings/Genshin/PUBG Mobile/Pokemon Go/Clash Royale；aiAssets=3 预生成+2 null
- 登录页文案 5 keys 改值 + 删 chipStudios/trustedBy（用户 4 轮 lock）
## B5 done 收尾未完项
- framework/proposed-learnings.md 当前空；本批次 done 时 Planner 一并提交 9+ 条候选（B5 7 轮 fixing 经验：deploy runbook prisma migrate 漏 / enrich 漏 / PM2 env_file 不重读 / aigcgateway action shape drift / timeout 5s 紧 / SHA 对齐 / Prisma Json cast / @visx alpha types / visual baseline GITHUB_TOKEN 不触发下游）
## 即将启动批次
- BIx-mvp-polish-pass (4 features ~3.5-4.5 day) — `docs/specs/BIx-mvp-polish-pass-spec.md`
## 角色分配
- 默认映射（role_assignments=null）：CLI = planner+generator，Codex = evaluator
## Backlog 9 条（全 Post-MVP）
BL-003/011/012/014/015/016/017/018/019 priority=low/deferred，不阻塞 MVP
## MVP 上线时间线
- ~05-05 MVP-internal-demo-prep done → 团队内部 demo
- ~05-10 BIx-mvp-polish-pass done

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
