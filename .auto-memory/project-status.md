---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-093-aigc-max-tokens-hotfix BUILDING (0/3) — ✅ PROD 故障已解除(充值止血), 本批转治本/防复发
- ✅ **故障已恢复(2026-06-08 用户充值 + Planner 实测 max_tokens=64000 chat 调用 success + 用户 UI 确认 Why 弹窗正常)**。
- 🔧 **根因修正**: 卡点是**上游 provider 额度**(报错 'requires more credits / afford X tokens'), **不是** aigcgateway 用户余额(get_balance 的 $39.56 是另一账本, 每次扣费用, 一直没动也正常)。用户充上游=充对了。两账本别混
- 仍做 BL-093 治本(防复发): max_tokens=64000 过度预留(实际输出~4500), 上游额度再波动会复发 → 降到 ~8000 免疫。杠杆点 `src/lib/aigc/run-action.ts` runAigcAction(~10 处). F001 验 gateway override → F002 实装全覆盖 → F003 Codex. BL-042 并入。**已非紧急, 正常优先级**
- ⚠️ kolmatrix hotfix, 部署 staging+prod(手动触发); prod deploy OOM 风险(BL-086 遗留)谨慎
## ✅ BL-091 DONE (5/5, signoff @ 0db24be) — YT 邮箱解锁修复, 184→523(+339, 99.4%)
## ✅ BL-086 DONE (6/6, signoff @ 8e99b8a) — 抓取加速; 部署 prod/staging@d58dabe + 爬虫@8f9320a
## ✅ 历史: BL-084/BL-083/BL-082/BL-081/BL-080⏸️(1/6)/BL-079-043
## 用户手工待办
1. ✅ aigcgateway 上游已充值, AI 故障已解除(2026-06-08)。BL-093 转防复发(非紧急)
2. **P0: TikHub 充值 `71@qq.com`** — 充值后→复查余额→重启容器+跑 BL-092(投喂2535+真实速率)
## Backlog
- **BL-092**(高): 充值后 F003 投喂 + 真实速率验证 + F004/F005 调优 + F001 runtime 验证
- BL-090-cost / BL-089 配置页 / BL-088 质量门 / BL-058 / BL-054
