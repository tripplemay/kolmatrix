---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-086-kol-acquisition-accel BUILDING (0/6) — 提升新 KOL 入库速率（积累模式）
- 源自 2026-06-06 Planner prod 只读诊断链：数量差异(3177vs2383=软删+质量门,无真丢失) → 旧源价值(2535独有但邮箱0.24%,定位 discovery 资产不复活) → 抓取慢根因 = **TikHub 余额~6/04 耗尽静默空转** + **refresh:discovery 配比失衡**(`TIER_INTERVAL_MS` hot1d 使 refresh 占~90%抓取量产0新增)
- 用户决策: refresh 积累档 **hot14d/warm30d/cold30d**(−87%负载) + discovery 拉满(扩种子+收割2535旧源id) + 余额可观测; 落地**路径B**(上游 PR guang-tech/apify→merge→sync,不积累分叉)
- 6 features: F001 tier积累档 / F002 种子扩充砍空转IG / F003 manual_seed收割2535 / F004 余额告警+成本记账 / F005 IG发现0产出排查 / F006 Codex双段验收
- ⚠️ 多数代码在上游 apify-kol-service(`/opt/apify-kol-service` docker, repo guang-tech/apify), kolmatrix CI 覆盖不到; F001/F004/F005 走 PR→sync, F002/F003 config/ops
- ⚠️ **整批部署不依赖余额, 但生效依赖充值** → 验收双段: 充值前=部署就绪/refresh负载降(next_refresh_at重算); 充值后=真实入库速率. manual_seed 通道=`POST /admin/seeds`
- 文档: spec `docs/specs/BL-086-kol-acquisition-accel-spec.md` + 诊断 `docs/reviews/kol-acquisition-diagnostic-2026-06-06.md` + **ADR-017**(源策略+上游抓取治理)
- Generator 起步建议: F001(tier.ts 最小改动) 或 F003(manual_seed 收割, 命中96%最高即时增量)
## ✅ BL-084-ai-match-panel DONE (9/9, fix_rounds=1, signoff @ d10351c) — /match AI 推荐三列工作台; prod 两端部署+migration核验 PASS
## ✅ BL-083 DONE (tag bl083-done @ b735aad) / BL-082 / BL-081 / BL-080⏸️PAUSED(1/6 等AI gen PNG) / BL-079-043 全 DONE
## 用户手工待办
1. **P0: TikHub 充值** — 否则 BL-086 部署完仍空转(余额$0,每call Insufficient balance)
2. 路径B需爬虫团队 merge 上游 PR — 建议提前知会
3. BL-080 素材就绪后恢复 landing illustration 批次
## Backlog (BL-088 质量门放宽/软删清理 · BL-089 爬虫策略配置页deferred · BL-058 fork数据 · BL-054 flaky · BL-048 valueScore)
