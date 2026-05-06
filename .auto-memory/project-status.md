---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🔍 BL-043 Bridge 闭合 — VERIFIED（Reviewer PASS scope；signoff pending）
- 3/3 done：F001 deploy-{staging,prod}.sh silent skip → fail-fast (exit 1 + multi-line error 指引指向 environment.md §Postgres) / F002 environment.md staging Postgres 段扩展（密码 sync 协议 + 修改 ops 5 步 + ALTER ROLE peer auth）+ 5 处一致子表 / F003 staging smoke 双路径：fail-fast path PASS（unset KOLMATRIX_APP_PASSWORD 退出 1）+ standard path PASS（HEAD=ce87a57 / health 200 / db ok / redis ok / git_sha 对齐）
- L1：lint / typecheck / bash -n PASS；`npm test` 仍有 1 个既有无关失败（AiSuggestionsClient.localStorage stub）
- spec literal Option B（SSH 注释 .env.staging 触发 workflow exit 1）未单独做，但 fail-fast path 已在 staging 真实环境验证
## 📝 BL-023 KOL 评分升级 — Planning lock 21:00（BL-043 done 后立即切 building；7 features 6-7h）
- spec：docs/specs/BL-023-kol-scoring-upgrade-spec.md（含 X1 BL-045 F007 顺手清）
- F001 真 engagement_rate 替 placeholder / F002 authenticity modifier / F003 测试 ≥6 / F004 similarityToScore 重映射（sim*100 不再 +1/2，0=0 非 50）/ F005 测试 ≥4 / F006 kol-sync-daily 后 trigger 重算 top 100 / F007 BL-045 dead code 顺手清
- BIx F004 cron 已部署在跑（修正 5/9 误判）：prod 137 KOL 已有真 engagement，daily 累积 +25-30 个；上线前累积 ~800+ KOL 真数据
## ✅ BL-044 — DONE 19:10 PASS 4/4 + Prod walk 12/12 PASS @ Codex（v0.9.15 跳过 proposed-learnings 空）
## 🐛 孤儿 campaign 4425e07e — BL-046 入 backlog high（5/12 与 BL-017 同期）
## 🚧 5/13 上线对外修正时间线（B + 修正 BIx F004 误判 → 时间线前移 1-2 天）
- 5/6~7 现：**BL-043 building**（Kimi ~2.5h）→ done
- 5/7 末：**BL-023 building**（spec 已 ready，~6-7h）→ done
- 5/8 周五：**BL-021 Suspense critical 5**（~2h）+ buffer + 用户业务测继承
- 5/11 周一：CSP+NULLIF 1 周观察期满评估
- 5/12 周二：**BL-017 token 过期+撤销** + **BL-046 product soft delete**（独立或合并）
- 5/13 周三 ⭐ 上线对外
## 用户手工待办
1. ~~prod redeploy + 12 处浏览器 walk~~ ✅ DONE 5/6 12 PASS by Codex
2. CSP/NULLIF 5/11 满期评估 + BL-035 真客户邮件触发再验
## 关键决议（已 lock）
- 5/6 21:00：BL-023 spec 起 + BIx F004 cron 误判修正（已在跑）+ BL-043 完后切 BL-023（用户笔误纠正 5:B）
- 5/6 19:55：BL-046 治本 1=D + 2=A
- 5/6 19:50：5 决议 X1 合并 + 4:A + 5:A
## 角色 / Backlog
- 默认映射：CLI=planner+generator，Codex=evaluator
- Backlog 17 条（high 4：BL-017/021/023/046；low 6；deferred 7）

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
