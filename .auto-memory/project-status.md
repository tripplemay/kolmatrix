---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧🔴 BL-093-aigc-max-tokens-hotfix BUILDING (0/3) — PROD 故障: AI 调用全线预检拒
- 根因实证: haiku-4.5 Action 默认 max_tokens=64000(模型上限, Action 抽象层不暴露); aigcgateway 余额 $39.56 只够 afford 55108<64000 → 全线请求瞬时拒(0.3s/$0/error)。非 BL-084 超时(历史 success 16-21s)。Blast: Why 弹窗 + KOL bio 富化等所有 haiku-4.5 Action
- 杠杆点 `src/lib/aigc/run-action.ts` runAigcAction(~10 处). F001 先验 gateway 是否接受 max_tokens override → F002 实装(wrapper 默认或 chat 直调, 全 actions/run 覆盖) → F003 Codex. max_tokens 须≥实际输出(~4500→设≥8000不截断)
- 🟡 **即时恢复=用户充值 aigcgateway**(+$15-20→余额~$55 afford>64000), 与 hotfix 并行; aigcgateway≠TikHub(不同账户). BL-042 治本并入本批
- ⚠️ kolmatrix hotfix, 部署 staging+prod(手动触发); prod deploy OOM 风险(BL-086 遗留)谨慎
## ✅ BL-091 DONE (5/5, signoff @ 0db24be) — YT 邮箱解锁修复, 184→523(+339, 99.4%)
## ✅ BL-086 DONE (6/6, signoff @ 8e99b8a) — 抓取加速; 部署 prod/staging@d58dabe + 爬虫@8f9320a
## ✅ 历史: BL-084/BL-083/BL-082/BL-081/BL-080⏸️(1/6)/BL-079-043
## 用户手工待办
1. **P0(新): aigcgateway 充值** — 立即恢复全线 AI; 与 BL-093 hotfix 并行
2. **P0: TikHub 充值 `71@qq.com`** — 充值后→复查余额→重启容器+跑 BL-092(投喂2535+真实速率)
## Backlog
- **BL-092**(高): 充值后 F003 投喂 + 真实速率验证 + F004/F005 调优 + F001 runtime 验证
- BL-090-cost / BL-089 配置页 / BL-088 质量门 / BL-058 / BL-054
