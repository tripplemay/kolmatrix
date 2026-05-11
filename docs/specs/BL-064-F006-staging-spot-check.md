# BL-064 F006 — Staging Spot Check 清单

> **目的：** Generator F001-F005 改动落 staging 后，用户走一遍清单验证 4 新路由 + 7+ 老路径 redirect + 5 语言 nav 在 staging 行为正确。
> **环境：** `https://staging.kol.guangai.ai` / marketer@kolmatrix.local / `KOLMatrix@2026!`
> **预估时长：** 5-10 分钟
> **结果落地：** `progress.json.evaluator_feedback` 写「✅ all PASS」或具体 fail 项

---

## 1. 登录 + 落地路由（1 项）

| # | 操作 | 期望 |
|---|---|---|
| 1.1 | 访问 `https://staging.kol.guangai.ai/login` 用 marketer 登录 | 登录成功后浏览器 URL 落在 `https://staging.kol.guangai.ai/en/insight`（**不是** /en/dashboard） |

## 2. 4 新路由可访问（4 项 × 5 语言 = 直接试 EN）

| # | URL | 期望 |
|---|---|---|
| 2.1 | `/en/brief` | 页面渲染（内容应为 Knowledge Base 现有 UI，左侧栏 "Brief" item 高亮） |
| 2.2 | `/en/match` | 页面渲染（内容应为 Discovery 现有 UI，左侧栏 "Match" item 高亮） |
| 2.3 | `/en/reach` | 页面渲染（内容应为 Outreach 现有 UI，左侧栏 "Reach" item 高亮） |
| 2.4 | `/en/insight` | 页面渲染（内容应为 Dashboard 现有 UI，左侧栏 "Insight" item 高亮） |

## 3. 老路由 302 redirect 兜底（11 项，spot 检 5 关键）

| # | 访问 | 期望 final URL |
|---|---|---|
| 3.1 | `/en/dashboard` | `/en/insight` |
| 3.2 | `/en/discovery` | `/en/match` |
| 3.3 | `/en/knowledge-base` | `/en/brief` |
| 3.4 | `/en/outreach` | `/en/reach` |
| 3.5 | `/en/campaigns` | `/en/match?view=campaigns` |

剩余 6 个（database / campaigns/new / campaigns/[id] / roi / weekly-report / analytics）若 3.1-3.5 全过可跳；e2e 已覆盖。

## 4. 顶部 Nav 4 项 + 5 语言切换（5 项）

| # | 操作 | 期望 |
|---|---|---|
| 4.1 | 默认 EN，左侧栏文字 | "Brief / Match / Reach / Insight"（**只 4 项**，无 Dashboard/Discovery/Database 等） |
| 4.2 | Topbar 切换语言 → 中文（简体） | 左侧栏 → "概要 / 匹配 / 触达 / 洞察" |
| 4.3 | Topbar 切换语言 → 日本語 | 左侧栏 → "ブリーフ / マッチ / リーチ / インサイト" |
| 4.4 | Topbar 切换语言 → 한국어 | 左侧栏 → "브리프 / 매치 / 리치 / 인사이트" |
| 4.5 | Topbar 切换语言 → Español | 左侧栏 → "Brief / Match / Reach / Insight"（loanword，可接受） |

## 5. Settings 入 user-menu（2 项）

| # | 操作 | 期望 |
|---|---|---|
| 5.1 | 左侧栏 | **不再有** Settings nav 项 |
| 5.2 | Topbar 右上角点头像 → 下拉 | 含 "Settings" 入口，点击跳转到 `/{locale}/settings` 现有页面（Profile + Sign out 也都在） |

## 6. 子路由 deep-link 保留（3 项）

| # | URL | 期望 |
|---|---|---|
| 6.1 | `/en/assets` | 页面正常渲染，**左侧栏 Brief 高亮**（adjudication §3） |
| 6.2 | `/en/crm` | 页面正常渲染，**左侧栏 Reach 高亮**（adjudication §3） |
| 6.3 | `/en/kols/{任一 KOL id}` | 页面正常渲染，**左侧栏 Match 高亮**（adjudication §3）|

## 7. /api/health git_sha 校验（必查 1 项）

```bash
curl -s https://staging.kol.guangai.ai/api/health | jq .git_sha
```

期望返回值 = `git rev-parse --short HEAD`（即 staging 跑的是 main 最新 commit）

---

## 反馈格式

全部 PASS：在 `progress.json.evaluator_feedback` 字段写：
```json
{
  "evaluator_feedback": {
    "BL-064-F006": "PASS — staging spot check 7 节全部确认，staging git_sha = {hash}"
  }
}
```

任一 FAIL：写明哪节哪项 + 复现 URL/操作 + 期望 vs 实际。Generator 进 fixing。
