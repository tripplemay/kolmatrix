# BL-094 高价值打包批次(CI 可靠性 + 成本可观测 + 补量量化)

> **Type：** 混合批次(F001/F002 generator 实装 + F003/F004 codex 分析/验收)。spec 软性(多为可靠性/治理),但含跨仓 + 决策门故记录
> **来源：** 2026-06-08 用户从 backlog 选三个"不等充值、可立即做"的高价值项打包
> **关联：** backlog BL-054 + BL-090-cost 并入(移除);BL-088 仅量化进本批(实装/硬删待 F003 报告后决定,留 backlog)· ADR-017

## §1 范围与原则

三项打包,但**BL-088 的不可逆/取舍部分不盲做**:
- F001/F002:清晰可实装(CI flaky 隔离 + 成本记账)。
- F003:**只读量化** BL-088,产出决策依据(806 回收价值 + 2584 硬删风险),**放宽质量门 / 硬删 2584 待用户据报告决定**,不在本批实装。

## §2 Features

### F001 — flaky 网络测试隔离 + glyph 覆盖 guard(BL-054,generator)
- **方向 A**:`tests/integration/pre-commit-hook.test.ts` 的 woff2 网络型用例隔离到独立串行 job(默认 `test:integration` 排除 + 新增 `test:integration:network` 串行 + CI 独立 job 允许 retry),根因=拉 Google Fonts subset 并发抖动。
- **方向 D**:`tests/integration/material-symbols-coverage.test.ts:158` 字节级比对 guard 改 **glyph-coverage 断言**(验 subset 含全部 icon 字形,而非字节相等),根治 Google Fonts 上游 build 漂移脆弱性。
- F005-grep:全仓搜其他网络依赖型 integration test 一并隔离(v0.9.14 完整模式)。
- L1 全绿;CI 默认套件不再因网络/上游漂移偶红。

### F002 — apify_cost_usd 成本记账(BL-090-cost,generator,路径 B)
- TikHub 不返回每请求成本(BL-042 实证)→ 用**端点价格表**(per TikHub 端点单价 × 调用次数)或 **usage-delta**(定期抓 TikHub 账户用量差额)估算,回填 `scrape_jobs.apify_cost_usd`(现全 0)。
- 配合 BL-086 F004 余额告警,让"预算→KOL"换算有数据支撑。
- 爬虫代码改动走路径 B(PR → guang-tech/apify → merge → sync);含单测。

### F003 — BL-088 量化(只读分析,codex)
- **只读** prod(kolmatrix Kol 表 + 上游)量化:
  - 806 质量门拦截的可回收价值:按**平台 × 粉丝段 × 是否有邮箱**拆;尤其 ≥1万粉 / 有邮箱占比(判断"量换质"是否值得)。
  - 2584 软删旧源硬删风险:`(tenant,platform,handle)`/`(tenant,platform,external_id)` 非 partial 唯一索引撞键风险 + 外键/依赖检查 + 是否已被 BL-091 收割消费(避免丢种子)。
- 产出:报告 `docs/test-reports/BL-094-F003-bl088-quantify-*.md` + 建议(是否放宽/放宽到什么档 / 是否硬删)。
- **不实装放宽/硬删** —— 留作 follow-up,待用户据报告决定。

### F004 — Codex L1+L2 + signoff(codex)
- L1:F001 lint/tsc/test 绿(含隔离后默认套件稳定);F002 PR merge+sync + 脚本单测。
- L2:F001 CI 默认套件连跑不再偶红 + 网络 job 独立;F002 部署后 `scrape_jobs.apify_cost_usd` 开始写入非 0。
- signoff `docs/test-reports/BL-094-signoff-2026-06-XX.md`(含 F003 量化报告结论引用 + BL-088 决策待办标注)。

## §3 风险

- F002 路径 B 依赖爬虫团队 merge(有排期);⚠️ /opt rebuild OOM 风险(BL-086 遗留,NODE_OPTIONS=4096 已验可缓解)。
- F003 只读,无风险;但其结论可能显示"806 不值得回收 / 2584 可安全硬删",据此用户决定 follow-up。
- F001 改 CI 套件结构,注意不破坏现有 CI gate。
