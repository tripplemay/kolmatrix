---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **BM2-campaign-outreach-roi** — status=planning，11 features（Campaign + 联系 + CRM + ROI + AI 周报）
  - Spec `docs/specs/BM2-campaign-outreach-roi-spec.md`（§6 + §F011 已吸收 BM1 F009 教训）
  - aigcgateway 3 Action 已建 + 验证：kol-email-customize (claude-haiku-4.5) / roi-insights + weekly-report-for-client (gemini-3-flash)
  - 估 8-12 天；等用户 go-signal 切 building；Generator F001 开工前做 pre-impl 审计（扫 schema）
- **BM1** ✅ done（9/9 PASS fix_rounds=2，signoff `docs/test-reports/BM1-console-kol-core-signoff-2026-04-23.md`）
- 所有前置批次 ✅：B0 / BI1 / BI2 / BI3 / BAux1 / BI4 / BM1

## MVP 现状（2/4 功能达成）
- ✅ 控制台（BM1 F007）/ ✅ 筛选 KOL（BM1 F004-F006）
- ⏳ 联系 KOL（BM2 F005-F006）/ ⏳ ROI 追踪（BM2 F008-F009）
- Prod 仍 `4b05cb60`（BI4 前快照）— BM1 签收通过，用户可随时 GitHub Actions 触发 prod deploy
- Staging 在 `c96fb98`（main 落后 3 commits，全是 state/report 文件，不影响运行）

## 角色分配（BM2，沿用 BM1）
- Planner: johnsong / Generator: johnsong / Evaluator: Reviewer

## 关键决策（详见 MVP PRD §11 + BM2 spec §3）
- Product USP 必填 / Google OAuth disabled / AI 走 aigcgateway Action
- AI 匹配分不做 MVP / KOL 价值分简单公式（归一化 0-100）
- Browser locale detection auto / AI 周报给客户看 PDF+share link
- BM1/BM2 L2 验收强制走 staging（2026-04-23 决议）
- **BM2 Resend mock fallback** / PDF 浏览器 print / 独立 WeeklyReport 快照表
- **MVP-visual-fidelity hotfix 批次**（2026-04-24 决议）：BM2 done 后启动，覆盖 BM1+BM2 5 页（C 档 pixel-perfect + 公共组件抽取），推迟 MVP 上线 ~1 周到 2026-05-14
- **Visual baseline PNG 入 git 是 PASS 硬门槛**（role-context/evaluator.md + framework/harness/ui-fidelity-guardrail.md）

## BM1 F009 教训（BM2 必遵守）
- 禁用 waitForLoadState("networkidle")
- 不硬编 seed-dependent count（staging 真数据变，用 regex/>0）
- revalidate 后 polling 15s / login redirect locale-prefixed URL

## Backlog 4 条
- BL-001 low / BL-002 medium / BL-003 deferred / BL-004 medium — BM2 done 后 polish micro-batch 一起收

## 环境
- 生产 DB `kolmatrix` / staging DB `kolmatrix_staging`
- Resend 发件 `marketer@kolquest.com`
- aigcgateway `https://aigc.guangai.ai/v1`（admintest key 已配两端）
