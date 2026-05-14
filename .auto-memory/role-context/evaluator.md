---
name: role-context-evaluator
description: Evaluator 角色行为规范 — 测试分层、UI 验收、签收报告（不存计划和进度）
type: feedback
---

## 测试分层 L1/L2

- L1（本地）= 基础设施（auth、路由、协议、读类）；L2（Staging）= 全链路（外部调用、计费、E2E 写入）
- **L1 FAIL ≠ 产品 Bug**（本地常用 PLACEHOLDER key/mock）；L2 需用户授权再执行
- acceptance 带 [L1]/[L2] 标注按层级处理，不在错误环境强行验证

## 测试域所有权

测试代码（单元、E2E、压测）由 Evaluator 编写；`executor:codex` 功能由 Evaluator 主动执行，报告写 `docs/test-reports/`

## UI 验收（含 Stitch 设计稿页面）

- 修改后必须与 `design-draft/stitch-references/<page>.html` 交叉校验（浏览器打开 HTML 而非 PNG，per `framework/harness/ui-fidelity-guardrail.md` §1.1 铁律）
- 语义替换 / 区块删除 = FAIL；结构简化 = PARTIAL
- 幽灵控件：`grep "type=\"checkbox\"\|<select\|<button" src/app/...` 找 active 控件，无 handler = FAIL
- Visual baseline PNG 必须 in git（`git ls-files tests/screenshots/baseline/`），空 = PARTIAL（scaffold 不算通过 — BM1 F009 踩坑根因）
- 签收报告新增 §Stitch 还原度评估章节，模板见 `framework/templates/signoff-report.md`

## 签收报告（硬性）

- reverifying → done 前必须写 `docs/test-reports/[批次名]-signoff-YYYY-MM-DD.md`（用 `framework/templates/signoff-report.md` 模板）
- progress.json `docs.signoff` 为空不得置 done

## VPS artifact in-git 核对（硬性）

"VPS 上产出 X"（脚本/config/cron/证书）的 feature 签收必须核对 in git：
`ssh ... "git ls-files <artifact-path>"` 空 = 拒绝签收。详见 `framework/harness/deploy-patterns.md` §2。

## E2E suite 稳定性诊断（2026-05-10 BL-060 实战）

单例 PASS / 整组 FAIL = **suite-level isolation 问题**（不是 case 内容/正则问题）。**根治：** 抽 `tests/e2e/<role>.setup.ts` + 各 spec opt-in `test.use({ storageState })`，N 次 login 收敛 1 次。来源 BL-060 fix-round 1 cc82a54（单点正则放宽失败）→ fix-round 2 f75cafd（storageState PASS）。

## SQL 跨 tenant 全量查询 RLS 注意（2026-05-10 BL-061 实战）

跨 tenant 全量验收 SQL 必须 `sudo -u postgres psql kolmatrix(_staging)` superuser bypass RLS。普通 `kolmatrix_app` role + Prisma RLS 跨 tenant 看 0 行（不是数据缺失，是 RLS 视角限制）。Reviewer only-read 验收尤其要走 superuser path。

## L1 + 角色门禁手动探针（2026-05-13 BL-065-R1 实战，v0.9.21）

L1 全绿（lint / typecheck / vitest / playwright fidelity / audit script）不等于 verifying PASS。Reviewer 必须**手动跑角色门禁探针**：登录 admin / marketer 双账号 → 访问角色限定路由 → **看 server console / pm2 logs** 是否含 `Error:` / `FORMATTING_ERROR` / `next-intl error`。Server console error 不影响 HTTP 200/307 状态码，CI 全绿和 audit script 全 PASS 都不会抓到。BL-065-R1 即是案例：admin 进入 /admin/kol-csv-import HTTP 200 但 server 日志含 FORMATTING_ERROR — 手动 probe 触发 fix-round 1。完整：`framework/harness/evaluator.md §20`。
