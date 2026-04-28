---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **B7a-discovery-smart-match** — status=verifying（2026-04-28 17:55 BJ）
- 进度：2/2 completed，fix_rounds=0
- role_assignments：planner=Kimi / generator=johnsong（本会话 cli=Kimi 接管）/ evaluator=Reviewer

## F001 + F002 acceptance 全部达成
- F001 pgvector + embedding pipeline：staging 3,303 KOL + 16 Product + prod 768 KOL 全 embed
- F002 /discovery Smart Match Dialog + POST /api/kols/smart-match + cosine top-K + Save All to Campaign

## L1 baseline
- typecheck/lint + unit 87/577 + integration 34+1 skipped / 255+2 skipped tests 全绿

## L2 staging
- git_sha=a00dbf2，build + pm2 reload 完成
- /api/health healthy
- /api/kols/smart-match 401 unauth（auth gate 验证）

## 跨批次延迟项（不阻塞 done）
- B6-F006 #4 接力条款 day-5 验证 ~2026-05-03
- B7b（4 features，7-8 day）：F003-F006 placeholder + ai-aux + i18n 4-locale translate + visual baseline 重捕全 locale
- B8（2 features，3 day，邀请发出后）：F007 KOL 相似推荐 + F008 多语言匹配

## 下游 lock
- B7a done → B7b building（~05-01）→ B7b done（~05-08）→ MVP-demo-launch sprint → 邀请 ~05-13
