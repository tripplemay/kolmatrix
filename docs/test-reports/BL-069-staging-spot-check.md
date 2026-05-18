# BL-069 Staging Spot Check 2026-05-18

> 状态：**FAIL**
> 执行者：Codex Reviewer
> 环境：`https://staging.kol.guangai.ai`
> 批次：`BL-069-brief-page-merge`
> 阶段：`verifying`

## 测试范围

- L1 基线：typecheck、BL-069 定向单测、Playwright 用例注册
- L2 staging：`/brief` AI parse dogfood、`unparsable`、`brief -> submit -> /match` 链路
- 24h parse-success gate：`scripts/bl069-cost-audit.ts --hours=24`
- legacy redirect 行为：`/knowledge-base`、`/knowledge-base/[productId]`、`/campaigns/new`

## 覆盖摘要

- PASS: `git pull --ff-only origin main` 后本地与远端同步，当前候选 `HEAD=ec26ba6`
- PASS: L1 `npm run typecheck`
- PASS: L1 BL-069 定向测试 `48 passed`
- PASS: Playwright 已注册 `brief-flow` / `ia-refactor-redirects` / `visual-regression` 相关用例
- PASS: staging `/api/health` healthy，staging repo sha=`ec26ba6d327f657adb06acc6bc8a6a6d8d018198`
- PASS: `/en/brief` 成功挂载，AI parse 可自动填表
- PASS: dogfood `14` 条 applied + `3` 条 unparsable，覆盖 `markets / budget / target_audience / locale`
- PASS: `brief -> submit -> /match?campaignId=` 真实链路打通
- PASS: `scripts/bl069-cost-audit.ts --hours=24` 输出 `15 / 18 = 83.33% — PASS`
- FAIL: legacy redirect HTTP 状态码仍是 `302`，不符合 spec 要求的 `301`
- FAIL: cap 满模拟未执行；当前仓库和 staging 未提供安全、文档化的注入机制，无法在本轮验收中完成该项

## 结构化测试用例

| ID | 用例 | 结果 | 证据 |
|---|---|---|---|
| T1 | L1 typecheck 通过 | PASS | `npm run typecheck` |
| T2 | L1 BL-069 定向测试通过 | PASS | `6 files, 48 tests passed` |
| T3 | Playwright 关键用例已注册 | PASS | `brief-flow.spec.ts` 6 case；`ia-refactor-redirects.spec.ts` 含 3 条 BL-069 redirect case；visual regression 含 `brief` / `brief?tab=products` |
| T4 | staging 健康与部署版本正确 | PASS | `/api/health=healthy`；repo sha=`ec26ba6d327f657adb06acc6bc8a6a6d8d018198` |
| T5 | `/en/brief` AI parse 自动填表 | PASS | 示例 query 自动填入 `product/budget/date/market/audience/category` |
| T6 | dogfood 覆盖 ≥10 applied + ≥3 unparsable | PASS | 汇总 `success=14 unparsable=3` |
| T7 | `brief -> submit -> /match?campaignId=` 链路打通 | PASS | 创建后落到 `/en/match?campaignId=2d11dd71-1a98-4ee0-b15d-314dae9fcd3c` |
| T8 | 24h parse success rate ≥80% | PASS | `15 / 18 = 83.33% — PASS` |
| T9 | `/knowledge-base` 为 301 永久跳转 | FAIL | 登录态真实请求 `reqid=185` 状态 `302`，`location=/en/brief?tab=products` |
| T10 | `/knowledge-base/[productId]` 为 301 永久跳转且保留 deep link | FAIL | 登录态真实请求 `reqid=231` 状态 `302`，`location=/en/brief?tab=products&productId=cprod1111111111111111` |
| T11 | `/campaigns/new` 为 301 永久跳转 | FAIL | 登录态真实请求 `reqid=153` 状态 `302`，`location=/en/brief?action=new` |
| T12 | cap 满模拟 | BLOCKED | 未发现安全 staging 注入开关；现有代码仅有单测 mock 覆盖 |

## L2 实测记录

### `/brief` parse success 样本

- EN:
  - `Launch Genshin Impact in Japan for women RPG fans with a 12000 USD budget in July 2026`
  - `Promote PUBG Mobile in Korea with 15000 USD for competitive mobile shooter creators in August 2026`
  - `Grow Pokemon Go in Europe with 8000 EUR focused on casual AR players and outdoor communities`
  - `Push Honor of Kings in Southeast Asia for MOBA fans with 9000 USD and strong female audience`
  - `Launch Clash Royale in LATAM with 7000 USD focused on strategy card creators and Spanish-speaking audiences`
  - `Promote Genshin Impact in Mainland China with 60000 CNY for open world RPG players in Q3 2026`
  - `Need a Japan and Korea campaign for Genshin Impact with 11000 USD and anime RPG audiences`
- ZH:
  - `帮我在东南亚推广王者荣耀，预算 9000 美元，面向 MOBA 女性玩家`
  - `给原神做日本市场活动，预算 12000 美元，偏 RPG 和二次元受众`
  - `在欧洲推广 Pokemon Go，预算 8000 欧元，面向休闲和 AR 玩家`
  - `在韩国推广 PUBG Mobile，预算 15000 美元，面向竞技手游玩家`
  - `在拉美推广 Clash Royale，预算 7000 美元，面向策略卡牌创作者`
  - `给原神做中国大陆市场活动，预算 60000 人民币，面向开放世界 RPG 玩家`
  - `帮我做日本和韩国双市场的原神 campaign，预算 11000 美元，偏动漫 RPG 受众`

### `unparsable` 样本

- `just help`
- `random thing`
- `随便搞一个`

### 端到端提交

- 从 AI 已填表单点击 `Create Campaign`
- 最终 URL：`/en/match?campaignId=2d11dd71-1a98-4ee0-b15d-314dae9fcd3c`
- `/match` 页面正常挂载并展示对应 campaign 上下文

### cost audit

命令：

```bash
ssh tripplezhou@34.180.93.185 'cd /opt/kolmatrix-staging && npx tsx scripts/bl069-cost-audit.ts --hours=24'
```

结果摘录：

- `calls: 18`
- `parse_applied / total: 15 / 18`
- `rate: 83.33% — PASS`

## 缺陷与阻塞

### B1. redirect HTTP 语义与 spec 不符

- 严重级别：High
- 实际结果：
  - 三条老路由登录态都正确跳到了新 IA
  - 但真实 document 请求状态码是 `302`
- 预期结果：
  - spec 明确要求 `301` 永久跳转
- 证据：
  - `reqid=185` `/en/knowledge-base` → `302` → `/en/brief?tab=products`
  - `reqid=231` `/en/knowledge-base/cprod1111111111111111` → `302` → `/en/brief?tab=products&productId=cprod1111111111111111`
  - `reqid=153` `/en/campaigns/new` → `302` → `/en/brief?action=new`
- 备注：
  - 当前 e2e 与 `src/middleware-helpers.ts` 也把行为写成了 `302`，这与 BL-069 spec 的 `301` 形成实现/测试/规格三方不一致

### B2. cap 满模拟缺少可执行 staging 手段

- 严重级别：Medium
- 实际结果：
  - 代码层仅找到单测 mock
  - staging 未提供安全的 debug flag、tenant override 或文档化操作步骤
- 影响：
  - 本轮无法完成 handoff 中要求的“cap 满模拟”

## 结论

- 本轮 `verifying` 结论：**FAIL**
- 核心功能链路本身已达标：
  - `/brief` 解析可用
  - dogfood 覆盖达标
  - 24h parse gate 达标
  - `brief -> /match` 链路达标
- 但 BL-069 仍不能签收，原因有二：
  1. spec 要求 `301`，实际是 `302`
  2. cap 满模拟缺少可执行验证路径

## 建议

1. Generator 先裁决 redirect 语义：若产品要求确实是永久跳转，应把实现与 e2e 一并改为 `301`；若 `302` 才是最终决定，应先回写 spec，再进入复验。
2. 为 cap-exhausted 增加 reviewer 可执行的 staging 验证入口，例如 staging-only env flag、test tenant override 或受控 mock 开关。
3. 修复后切 `reverifying`，我会优先重跑 T9-T12，再决定是否签收。
