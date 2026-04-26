---
name: MVP-seed-demo-prep
description: MVP 上线前最后批次 - 种子用户 demo 准备（账号、数据、引导、烟测）
status: draft
created_by: Kimi (Planner)
created_at: 2026-04-27
estimated_effort: 2-3 day
prerequisites:
  - MVP-visual-fidelity-hotfix done
  - BL-013 push 到 main + prod deploy 触发完成
  - prod L2 健康基线
---

# MVP-seed-demo-prep — 种子用户 demo 准备

## 1. 背景与目标

MVP 4 大能力（Discovery / Campaign / Outreach / ROI+Weekly Report）已经在 BM1 + BM2 + visual-fidelity hotfix 后达成可上线状态。**本批次是 MVP 正式上线前的最后准备工作**，目标：

1. **种子用户开箱即用**：每个种子用户拿到账号即能完整走 Journey A/B/C，不需要技术支持
2. **演示路径清晰**：用户首次登录就能看到 4 大能力的引导，知道从哪里开始
3. **数据真实可信**：演示数据来自真实游戏 KOL（不是 lorem ipsum），让用户感觉"成熟产品"
4. **prod L2 烟测覆盖**：BM2 + hotfix 全功能在 prod 真跑通，无 deploy 偏移

**非目标：**
- 不做 onboarding wizard（弹窗引导组件）— MVP 用静态文档 + 演示数据自助引导
- 不做 in-app tutorial（产品内逐步引导）— Post-MVP B7+
- 不做正式 marketing site / pricing page — 独立工作（用 kolquest.com 落地页）
- 不做用户支持系统（intercom / zendesk）— Post-MVP

## 2. 范围

### In Scope（5 features）

1. **F001** — Demo tenant seed 脚本（独立于测试 seed）
2. **F002** — Onboarding 文档（用户首次登录前后的引导文本）
3. **F003** — 演示脚本 / video walkthrough（Planner / 用户写，Generator 不参与）
4. **F004** — prod L2 烟测清单 + 执行（Reviewer / 用户）
5. **F005** — Demo 账号发放流程 + 安全 checklist

### Out of Scope

- 自动 onboarding wizard / tooltip（Post-MVP）
- A/B testing / 转化率优化（Post-MVP）
- 用户分析埋点（已有 event_log + audit_log，足够 MVP）
- Email marketing / drip campaign（Post-MVP B4-extended）
- 多语言 marketing 文案（MVP 仅 en + zh，PRD §11 已锁）

## 3. 关键设计决策

| 决策 | 选定方案 | 理由 |
|---|---|---|
| Demo 账号模式 | **每个种子用户独立 tenant + 1 admin + 1 marketer 账号** | 数据隔离，避免互相看见；模拟真实多租户场景 |
| Demo 数据源 | **基于现有 seed.ts 12 KOL + 3 campaigns 改造为「Studio Demo」品牌主题** | 复用已有演示数据，不重建轮子 |
| 密码策略 | **首次随机 16 位（rotate-on-first-login 提示）** | 安全 baseline；prod 不能像 staging 用 KOLM@2026! |
| onboarding 形式 | **欢迎邮件（含登录信息）+ 在线 PDF 引导（5 页 A4）** | MVP 简化；非 wizard |
| Demo 周期 | **30 天试用，到期前 7 天提醒** | 给种子用户充分体验时间，但避免无限期占资源 |
| 烟测分工 | **L2 自动化（Playwright @prod）+ 用户手动 1 次完整 Journey A 走查** | 自动化覆盖回归 + 人工覆盖 UX 体验 |
| Demo 数据多样化 | **3 套预制 demo dataset（小型/中型/大型 game studio）** | 不同种子用户拿不同 dataset 避免雷同感；MVP 阶段先 1 套通用 |
| 邀请方式 | **AccessRequest 流程（已有 BI3-F005）+ admin 后台一键 approve** | 复用现有审批流程 |

## 4. 功能列表

### F001 — Demo tenant seed 脚本

**实现：** 新建 `scripts/seed-demo-tenant.ts`，独立于 `prisma/seed.ts`（测试 seed）。

```bash
# CLI 用法（Generator 实现）
npm run seed:demo -- --name "Acme Game Studio" --admin-email "founder@acme.com"
# 自动生成：
# - Tenant { name, slug=auto-from-name, plan="trial" }
# - User { admin, email, password=随机 16 位 }
# - User { marketer, email=marketer@<slug>.demo, password=随机 16 位 }
# - 12 KOL（基于 seed.ts 12 个，改 brand 名）
# - 3 Campaigns（typical：Active / Draft / Completed 各 1）
# - 5 Products（gaming category）
# - 10 EmailTemplate（system 共享，已有）
# - 100 EmailLog（演示历史）
# - 5 KolCampaign relationships
# - 1 WeeklyReport（上周示范）
# - 输出：账号信息（带密码）+ 登录 URL → 用于发邀请邮件
```

**Acceptance：**
- 幂等（重跑 --name=同名 → upsert，不重复建）
- 密码用 crypto.randomBytes(12).toString('base64url') 生成，bcrypt cost=12 hash
- 输出格式 JSON 文件 → `docs/seed-demo-output/<slug>-credentials.json`（gitignore）
- demo plan="trial"，trial_expires_at = now + 30 day
- tests/integration/seed-demo-tenant.test.ts（覆盖幂等 + 密码强度 + 数据完整）

### F002 — Onboarding 文档

**实现：** 新建 `docs/user-guide/`：

```
docs/user-guide/
├── 01-welcome.md         — 欢迎信 + 4 大能力概述
├── 02-quick-start.md     — 30 分钟首次体验（Journey A 全程）
├── 03-discovery.md       — KOL 发现页详解（15 维 filter）
├── 04-campaigns.md       — Campaign 创建 + KOL 加入 + 邮件触达
├── 05-roi-and-reports.md — ROI 追踪 + AI 周报生成 + 分享
├── 06-faq.md             — 30 条常见问题
└── assets/               — 截图（来自 stitch-references/renders/ 的高清版本）
```

**Acceptance：**
- 6 文档全部 ≥ 800 字 / file，bilingual（en + zh 各一版）
- 截图至少 12 张（4 大能力各 3 张）
- 渲染为 PDF（用现有 `@media print` 工具栈）
- 上传 docs/user-guide/welcome-onboarding-en.pdf + welcome-onboarding-zh.pdf
- 内容引用真实 demo 账号场景（不用 lorem ipsum）

### F003 — 演示脚本 + video walkthrough

**实现：** **Planner / 用户负责（不属 Generator 工作）**

`docs/marketing/demo-walkthrough-script.md`：
- 5 分钟 demo 脚本（按 Journey A 走）
- 录制要点：开场 30s 介绍 → 90s Discovery → 90s Campaign → 60s ROI → 30s 结语
- 录制工具：用户自选（Loom / OBS / QuickTime）
- 视频上传到内部 Notion，链接给种子用户

**Acceptance：**
- 脚本字数 800-1200，逐段标时间轴
- 视频 ≤ 6 分钟，1080p
- 视频链接登记到 `docs/user-guide/01-welcome.md` 顶部

### F004 — prod L2 烟测清单 + 执行

**实现：** 新建 `docs/test-cases/MVP-prod-launch-smoke-checklist.md`，并由 Reviewer 在 prod deploy 后执行。

**清单内容（参照 BM2-L2-staging-checklist 格式）：**
- 健康基线：`/api/health` 200 + git_sha 正确（BL-013 修后 health git_sha 应已修复）
- F001-F010 BM2 全功能 prod 路径走查（同 staging L2 清单，URL 替换为 prod）
- visual baseline：访问 6 张 baseline 对应路由对比
- 跨租户隔离烟测
- 性能基线：每页 LCP < 2.5s（用 lighthouse / web vitals）
- AI Action 真调用（消耗少量 aigcgateway 余额）：1 次 outreach AI 定制 + 1 次 weekly-report 生成
- 邮件真发（用户 1 个测试邮箱，**禁止给真实 KOL 发**）

**Acceptance：**
- 清单 ≥ 30 条 checkbox
- Reviewer 签收 `docs/test-reports/MVP-prod-launch-signoff-<date>.md`
- 任何 P0/P1 失败 → status 切回 fixing，Generator hotfix；P2/P3 写 backlog 不阻塞上线

### F005 — Demo 账号发放流程 + 安全 checklist

**实现：** `docs/ops/demo-account-onboarding-runbook.md`：

**5 步 runbook：**
1. **收集种子用户信息**（name / email / company / use case 1 句话）— Google Form 链接
2. **后台审批 AccessRequest**（admin 在 prod 后台 `/admin/access-requests` 点 approve）
3. **跑 seed 脚本**（`npm run seed:demo --name=... --admin-email=...` 在 prod VM）
4. **发邀请邮件**（手动用 Resend dashboard 或本地脚本，**不**用 BM2 outreach 流避免污染 EmailLog）
   - 邮件含：登录 URL / admin email / **临时密码（用户首登强制改）** / Quick Start PDF / Demo 视频链接
5. **首登确认**（24 小时内 admin 邮件确认收到，未到则跟进）

**安全 checklist：**
- [ ] Demo 账号密码不入 git（输出 JSON 在 gitignore 列表）
- [ ] Demo tenant 数据加 `is_demo=true` 标记，便于 30 天后清理
- [ ] 后台 cron job 每天扫 trial_expires_at < now() + 7d → 发到期提醒；< now() → 锁定账号（不删数据，30 天后再删）
- [ ] AIGCGATEWAY API key rate limit 监控（避免恶意试用消耗）
- [ ] Resend rate limit 监控（每 demo tenant 24h 内最多 50 邮件）

**Acceptance：**
- runbook ≥ 50 行，含每步具体命令
- safety checklist 7 条覆盖 100%（其中 cron job 锁账号是 BM3 工作，本批次留 TODO）
- 用户 dry-run 1 次完整流程验证可操作

## 5. 依赖关系

```
F001 (seed 脚本) ────┐
                    ├─→ F005 (发放 runbook)
F002 (用户文档) ────┤
                    ├─→ Demo 账号可发放
F003 (演示视频) ────┘

F004 (prod 烟测) ─→ 独立路径，prod deploy 后立即跑
```

**强依赖：** F001 + F002 + F003 + F005 → 缺一不可（Demo 不能发）；F004 独立验证 prod 健康

**推荐顺序：** F004（prod 烟测，最先验证 prod 健康）→ F001 → F002 + F003（用户/Planner 并行）→ F005

## 6. 风险与对策

| 风险 | 严重度 | 对策 |
|---|---|---|
| prod L2 发现新阻断（BM2 + hotfix 集成漂移） | 高 | F004 先做，发现问题立即 fixing 不发 demo |
| Demo 数据演示后被种子用户当真（混淆 demo vs prod） | 中 | F005 安全 checklist + tenant.is_demo 标记 + 上线邮件明示「30 天试用」 |
| AIGCGATEWAY 余额被试用消耗（当前 $49.60） | 中 | F005 监控 + 每 demo tenant 设软限额（每日 10 次 AI 调用上限）— 软限额由 BM3 实现，本批次 TODO |
| Resend 真发邮件被滥用（垃圾邮件投诉） | 中 | F005 软限额 + 退订链接（B4-extended 范围，本批次先在每封邀请信尾部硬编 unsubscribe email link） |
| 用户文档与实际页面漂移（hotfix 改 UI 后） | 中 | F002 截图必须在 hotfix done 后才生成，不要早做 |
| 演示视频录制后再次 UI 变化 | 中 | F003 录制时机 = MVP-visual-fidelity hotfix done 后第 1-2 天 |
| 种子用户找不到首页入口 | 低 | F002 quick-start.md 顶部硬编 prod URL + 视频链接 |

## 7. 验收方式（Evaluator 阶段）

### L1 自动化
- F001 seed:demo 脚本 idempotent + 密码强度 + 数据完整 → unit/integration tests 全绿
- typecheck / lint / 现有 BM1+BM2+hotfix 测试套不退化

### L2 staging
- 在 staging 跑 1 次 seed:demo --name="L2 Test Studio" → 拿到账号 → 浏览器登录 → 完整走 Journey A → 数据正确

### L3 prod 烟测（本批次特有）
- F004 清单 30 条 checkbox 全勾
- Reviewer 签收 prod-launch-signoff

### L4 用户验证（特殊）
- 用户找 1 个真实种子用户做 dry-run（先用 Demo 账号自己跑一遍 Journey A 给用户看 → 用户复盘易用性 → 收 5 条改进点入 backlog）

## 8. 引用文档

- `docs/product/KOLMatrix-MVP-PRD.md` §1-9（用户画像 + Journey + 功能）
- `docs/specs/MVP-visual-fidelity-hotfix-spec.md`（前置批次）
- `docs/test-cases/BM2-L2-staging-checklist-2026-04-26.md`（参考清单格式）
- `prisma/seed.ts`（演示数据基础）
- `.auto-memory/environment.md`（prod / staging URL + 测试账号）
- `framework/harness/deploy-patterns.md`

## 9. 启动检查清单（Generator 开工前）

- [ ] MVP-visual-fidelity-hotfix done + signoff 入 git
- [ ] BL-013 修复 push 完成 + prod redeploy 触发 + prod git_sha 验证正确
- [ ] prod /api/health 200 + DB ok（已经过 BL-013 修复后必备前提）
- [ ] aigcgateway 余额 ≥ $30（demo 试用消耗预留）
- [ ] Resend 域名 verified + 可发 ≥ 100 邮件 / day（默认配置足够 MVP）

## 10. 估时

| 环节 | 预估 | 执行者 |
|---|---|---|
| F001 seed:demo 脚本 + tests | ~0.5 day | Generator |
| F002 用户文档 6 文件（en/zh）+ PDF | ~1 day | Generator + Planner（文案） |
| F003 演示脚本 + video 录制 | ~0.5 day | Planner / 用户 |
| F004 prod 烟测清单 + 执行 | ~0.5 day | Planner（清单）+ Reviewer（执行） |
| F005 发放 runbook + safety checklist | ~0.5 day | Planner |
| 缓冲（安全 / 反复修文档） | ~0.5 day | — |
| **总计** | **~2.5-3 day** | — |

## 11. 与 MVP 上线时间线

| 节点 | 预估完成 |
|---|---|
| MVP-visual-fidelity-hotfix done | ~2026-05-02 |
| BL-013 push + prod deploy 触发（用户手动） | 2026-05-02 |
| MVP-seed-demo-prep（本批次 5 features） | 2026-05-02 ~ 2026-05-05 |
| 首批种子用户邀请发出 | **2026-05-05** ⭐ |
| 第 1 批 5 个种子用户 onboarded + 30 天试用启动 | 2026-05-05 ~ 2026-06-04 |
| BAx-seed-feedback 批次启动（基于反馈） | ~2026-05-12（首周反馈） |

---

**Spec 状态：** draft（2026-04-27 Planner 起草，hotfix done 后切 planning → building）

**待用户确认：**
1. demo 周期 30 天是否合适？（短：紧迫感强 / 长：体验充分）
2. 首批种子用户数量目标？（建议 5-10 人，便于 1:1 反馈）
3. 邀请邮件用谁的发件人？（marketer@kolquest.com 已配 / 或新建 founder@kolquest.com）
4. video walkthrough 录制谁做？（用户 / Planner 起草脚本）
5. 是否需要把 F004 prod 烟测拆出来独立 micro-batch（与 F001-F003 解耦）？
