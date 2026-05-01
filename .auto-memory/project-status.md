---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---

# Project Status — KOLMatrix

**Last Updated:** 2026-05-01 (johnsong fix-round 3)
**Sprint:** MVP-internal-demo-prep | **Status:** reverifying | **fix_rounds:** 3

## Reviewer round-2 报告两条缺陷已修
- **C-10 真因**：customize.ts:toVariables 传 `template_subject`/`template_body`，但 aigcgateway action 期望 `original_subject`/`original_body` → 400 → http_error → "AI service could not respond"。直接 curl prod aigcgateway 确认。修复：重命名 + export `toVariables` + `KOL_EMAIL_CUSTOMIZE_VARIABLE_KEYS` 锁 wire-format contract
- **C-13**：headless 不触发 beforeprint。修复：handleDownload 在 window.print() 前 dispatch `kolmatrix:weekly-report-download` CustomEvent

## CI 修复链 (fix-round 3)
4 commits — 主因 vi.stubGlobal('fetch') 与 MSW 拦截器在 Node 20 互动不可靠。最终方案：导出 toVariables 成 public，contract test 测纯函数，绕开 fetch

## Deploy Status (2026-05-01 fix-round 3)
✅ Staging 6f33a55: healthy
✅ Prod 6f33a55: healthy / git_sha = HEAD
✅ aigcgateway 端到端 curl 验证：200 + valid output（成本 ~$0.002/次）

## Ready for Reviewer Round-3 Reverify
- prod git_sha = 6f33a55（matches HEAD）
- 重点验证 C-10（登录→/outreach→AI customize 应返 preview）+ C-13（Download PDF dispatch event listener）
- 报告路径建议: docs/test-reports/MVP-internal-demo-prep-reverifying-2026-05-01-round-3.md

## 经验沉淀
- vi.stubGlobal + MSW 不可靠 → 用 server.use() handler 或 public pure-helper unit test
- aigcgateway action 字段命名漂移须靠 contract test 锁定（本次 BM2-F006 的隐 bug 拖了 4 轮才发现）

## Backlog
9 entries: BL-003/011/012/014/015/016/017/018/019 + BL-020/021/022 (all Post-MVP)
