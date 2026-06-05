---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-084-ai-match-panel PLANNING→building (0/9, fix_rounds=0) — /match?campaignId=X 重塑 AI 推荐三列工作台
- A0 audit (6/05): 主面板 runMatchSearch 完全不读 campaignId (装饰参数), AI Sidebar 输出 3 条 workflow 建议非 KOL 推荐, 严重 UX 错位; B7a-F002 runSmartMatch 已 ship 完整 embedding cosine + KOL 99.5% + Product JIT 可复用
- A1 8 子决策 lock: 推荐源 B (embedding 召回 200 + LLM 重排 30) / Toggle 切换 / 数据模型 A (kol_campaign + suggestion_status enum 4 态) / embedding 无需 prep / matchReason 短文本 / Accept 一键+5s Undo / Swap drag / Toggle 默认 campaignId 有→AI
- 9 features: F001 runSmartMatch 升级 / F002 LLM 重排 / F003 schema 4 字段 / F004 server action 编排+24h cache / F005 accept/skip/swap actions / F006 UI 三列 / F007 toggle 路由 / F008 i18n / F009 Codex
- 月 cost <$1. ADR-016 (kol_campaign 推荐生命周期 4 态) 待 F009 起草
- 关联 docs/specs/BL-084-ai-match-panel-spec.md
## ✅ BL-083-yt-business-email-mapper DONE (7/7, fix_rounds=1, tag bl083-done @ b735aad)
- prod kol_emails 0.8%→30.3% (219 business-unlock), legacy 18 不变
- signoff: `docs/test-reports/BL-083-signoff-2026-06-05.md`
- fix_rounds=1 教训: Reviewer grep tests/ miss colocated __tests__ (Framework Learnings 已记)
## ✅ BL-082 DONE (7/7, fix_rounds=1, tag bl082-done @ 133bbe0) — refresh phase 重接 / prod 251 ids 0%404
## ✅ BL-081 DONE (6/6, tag bl081-done @ 7bfeacb) — country mapper bug + retry storm, prod LLM 83/天
## ⏸️ BL-080 PAUSED (1/6 @ ad14bdd) — 等用户跑 AI gen PNG
## ✅ BL-079 / BL-078 / BL-077 / BL-076 / BL-075 / BL-074 / BL-073 / BL-072 / BL-071 / BL-070 / BL-069-059 / BL-055-049 / 043+044 全 DONE
## 用户手工待办
1. TikHub 新 token 重发 (旧 token 仍 working)
2. 找爬虫团队对账 fork `0-discover` (5/27 + 5/31)
3. BL-080 素材就绪后恢复 landing illustration 批次
## Backlog
- BL-080 (paused) / Phase 5 个性化学习 / BL-054 flaky test / BL-048 valueScore 区分度
