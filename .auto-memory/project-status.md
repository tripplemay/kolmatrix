---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-086-kol-acquisition-accel VERIFYING (5/6 gen done, F006=codex) — 提升新 KOL 入库速率（积累模式）
- **5 个 generator feature 全完成 + 3 PR(#3/#4/#5)已 merge 到 guang-tech/apify master + /opt sync 部署 @ 8f9320a**。端到端验证: `/admin/stats` 返 `tikhubBalanceUsd:0.0005`(F004 余额暴露生效, 也证实余额≈0)
  - F001 tier 积累档(hot14d/warm30d/cold30d, #3) / F002 schedules 30→48(applied) / F003 manual-seed 收割脚本(dry-run 2535) / F004 余额暴露+kolmatrix 静默空转告警(#5) / F005 IG 429 节流 350ms(#4, 根因=per-author 突发触发账户级限流)
- 🟢 **F006 验收口径已解耦充值(用户 2026-06-06)**: 本批止于"部署就绪"即可 done(Codex 现在可验); 真实速率验证 + F003 真实投喂 → deferred **BL-092**(充值后明天). Codex 起 F006 部署就绪半段
- 🔴 **TikHub 充值未到账**(71@qq.com balance=$0.0005, 用户明天完成). 充值前投喂会被 worker 消费成 succeeded-0=白做, 必须充值后
- 🟢 **prod outage 已恢复(2026-06-07)**: 6/06 两次 deploy-prod build OOM 拖垮整机(VM 仅7.8Gi跑 kolmatrix+pg+aigcgateway+apify-docker)→主机 thrash 不可达。用户 reset VM 后 Generator 逐服务重建 .next(prod kol.guangai.ai 200✅ / staging 200✅ / apify 3004 ok✅, docker compose up -d 修 postgres 网络竞态)。**⚠️ 内存超额未根治前勿重试 prod 部署(会再 OOM)**; 防复发选项(swap/部署时停apify-docker/扩VM/CI出artifact)待定。详见 proposed-learnings
- ops 缺口(已沉淀 learning): /opt 无凭据 pull guang-tech/apify → 本次 git bundle scp 绕开; 长期应配 deploy key
- 文档: spec `docs/specs/BL-086-...spec.md` + 诊断 `docs/reviews/kol-acquisition-diagnostic-2026-06-06.md` + ADR-017
## ✅ BL-084 DONE (9/9, signoff @ d10351c) / BL-083(@b735aad) / BL-082 / BL-081 / BL-080⏸️(1/6 等AI gen) / BL-079-043 全 DONE
## 用户手工待办
1. **P0: TikHub 充值 `71@qq.com`(明天完成)** — 充值后通知 → Planner 复查 `get_user_info` 余额>0 → 重启容器清欠账 + 跑 BL-092(F003 投喂 2535 + 真实速率验证). 安全: 部署中 token 曾在 402 响应泄露片段, 建议事后轮换
2. 催爬虫团队后续: BL-091(YT 邮箱 bug)若立项需其 review/merge
## Backlog 重点
- **BL-092**(高): 充值后 F003 投喂 + 真实速率验证(refresh 负载/新增回升/IG/告警)+ F004/F005 按真实数据调优
- **BL-091**(中): YT 邮箱 BugA 触发器放错路径 + BugB yt_email_check_records 双写失效 + 344 backfill(已小批验证 kol6/9 解锁, 走 Apify 不依赖 TikHub)
- BL-090-cost / BL-089 配置页 / BL-088 质量门 / BL-058 fork / BL-054 / BL-048
