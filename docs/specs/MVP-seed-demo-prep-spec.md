---
name: MVP-seed-demo-prep
description: MVP 上线前最后批次 - 种子用户 demo 准备（账号、数据、引导发放） + 已并入 MVP-demo-launch 合并 sprint（含 B5）
status: decisions-locked + merged-sprint
created_by: Kimi (Planner)
created_at: 2026-04-27
decisions_locked_at: 2026-04-27
merged_into: MVP-demo-launch（9 features = 本批次 4 + B5-kol-data-enrichment 5），用户 2026-04-27 选 B2 合并方案
estimated_effort: 5-6 day（合并后；本批次部分仍 2-2.5 day）
features_count: 4（合并 sprint 内）
prerequisites:
  - MVP-visual-fidelity-hotfix done ✅
  - MVP-i18n-full-locale done（verifying 中）
  - MVP-kol-seed-redo done（schema metadata.youtube.* 已填）
  - 用户触发 prod deploy 完成
  - MVP-prod-launch-smoke done（必须先确认 prod 可承接种子用户）
---

## ⭐ 合并 sprint 说明（用户 2026-04-27 选 B2）

本批次与 `B5-kol-data-enrichment` 合并到单一 sprint **MVP-demo-launch**（9 features 串行）。

**执行顺序（Generator 视角）：**
1. B5-F001 schema migration（~3-4h，先做，让 demo seed 用新字段）
2. B5-F002 enrich KOL + metadata 升级到列（~2-3h）
3. **demo-prep F001** demo tenant seed 脚本（~0.5 day，基于新 schema）
4. **demo-prep F002** 用户文档（~1 day）
5. B5-F003 Discovery filter +3 维 + 高级筛选折叠（~4-5h）
6. B5-F004 KOL 详情页改造（banner + 6 视频 + 词云 + 真 engagement + 隐藏 audience）（~5-6h）
7. B5-F005 i18n 新 keys + 守门 tests（~2-3h）

**Planner / 用户并行（不占 Generator）：**
- **demo-prep F003** 演示脚本起草（Planner，~0.3 day）+ 视频录制（用户）
- **demo-prep F004** 发放 runbook（Planner，~0.5 day）
- prod-launch-smoke 整批（Reviewer，~半天）

**时间线影响（用户 2026-04-27 二次更新：B6 优先 = 方案 A）：**
- 邀请发出 ~2026-05-09（推迟 vs 原 demo-launch only 05-07）
- 推迟 2 天换取 B6 自动同步前置（邀请发出时已 5 天自动数据增长）
- 优势：邀请发出时 KOL 库不仅含完整 enriched 数据，还在持续生长（"产品在迭代" PMF 信号）

**最终时序：**
```
~04-28  kol-seed-redo done
~04-28  B6-kol-daily-sync 启动（Generator）
~05-03  B6 done + 第一次 cron 自动跑
~05-03  MVP-demo-launch 启动（本 9 features 合并 sprint）
~05-09  done + 邀请发出 ⭐ MVP 上线
```

**详见：** `docs/specs/B5-kol-data-enrichment-spec.md` §10 时序方案 B2 + `docs/specs/B6-kol-daily-sync-spec.md` §13 时序方案 A

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

### In Scope（4 features，原 F004 已拆出独立 micro-batch）

1. **F001** — Demo tenant seed 脚本（独立于测试 seed）
2. **F002** — Onboarding 文档（用户首次登录前后的引导文本）
3. **F003** — 演示脚本（Planner 起草脚本，**用户负责录制 video walkthrough**）
4. **F004** — Demo 账号发放流程 + 安全 checklist（原 F005，拆 F004 后重新编号）

**已拆出：** ~~F004 prod L2 烟测~~ → 独立 micro-batch `MVP-prod-launch-smoke-spec.md`（与本批次平行执行，prod deploy 后立即跑，是本批次发邀请的硬前提）

### Out of Scope

- 自动 onboarding wizard / tooltip（Post-MVP）
- A/B testing / 转化率优化（Post-MVP）
- 用户分析埋点（已有 event_log + audit_log，足够 MVP）
- Email marketing / drip campaign（Post-MVP B4-extended）
- 多语言 marketing 文案（MVP 仅 en + zh，PRD §11 已锁）

## 3. 关键设计决策

| 决策 | 选定方案 | 用户裁决（2026-04-27） |
|---|---|---|
| Demo 账号模式 | **每个种子用户独立 tenant + 1 admin + 1 marketer 账号** | — |
| Demo 数据源 | **基于现有 seed.ts 12 KOL + 3 campaigns 改造为「Studio Demo」品牌主题** | — |
| 密码策略 | **首次随机 16 位（rotate-on-first-login 提示）** | — |
| onboarding 形式 | **欢迎邮件（含登录信息）+ 在线 PDF 引导（5 页 A4）** | — |
| **Demo 周期** | **30 天试用，到期前 7 天提醒** | ✅ 用户确认 30 天 |
| **首批种子用户数量** | **5-10 人** | ✅ 用户同意 |
| **邀请邮件发件人** | **`marketer@kolquest.com`**（已配，未来可换 founder@） | ✅ 用户同意（不新建 founder@）|
| **video walkthrough 录制** | **Planner 起草脚本 → 用户负责录制** | ✅ 用户回答"我们做" |
| **prod 烟测拆批** | **拆出独立 micro-batch `MVP-prod-launch-smoke`** | ✅ 用户回答"按你的建议执行" |
| Demo 数据多样化 | **3 套预制 demo dataset（小型/中型/大型 game studio）** | MVP 阶段先 1 套通用，3 套留 Post-MVP |
| 邀请方式 | **AccessRequest 流程（已有 BI3-F005）+ admin 后台一键 approve** | — |

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

### F003 — 演示脚本（Planner 起草，用户负责录制 video）

**实现：** **Planner 起草脚本 → 用户用 Loom / OBS / QuickTime 录制**

`docs/marketing/demo-walkthrough-script.md`（Planner 起草）：
- 5 分钟 demo 脚本（按 Journey A 走）
- 逐段标时间轴：开场 30s 介绍 → 90s Discovery → 90s Campaign → 60s ROI → 30s 结语
- 每段含旁白文本 + 操作步骤 + 期望页面截图
- bilingual（en + zh 各一版，给不同种子用户用）

**用户工作（不属 Generator）：**
- 用户用 Loom / OBS / QuickTime 录制 ≤ 6 分钟 1080p 视频
- 视频上传到内部 Notion / YouTube unlisted
- 视频链接 → 由 Planner 登记到 `docs/user-guide/01-welcome.md` 顶部

**Acceptance：**
- 脚本字数 800-1200，逐段标时间轴
- 脚本 bilingual en + zh
- 用户录制完成后 Planner 把视频链接更新到 user-guide

### ~~F004 — prod L2 烟测清单 + 执行~~（已拆出独立 micro-batch）

**移到：** `docs/specs/MVP-prod-launch-smoke-spec.md`（独立 1 day micro-batch，与本批次平行执行）

**关系：** prod-launch-smoke done 是本批次发邀请的硬前提；不放在本批次内是为了让 Reviewer 在 prod deploy 后立即开跑，不依赖 Generator 的 demo prep 进度。

### F004 — Demo 账号发放流程 + 安全 checklist（原 F005，重新编号）

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
[平行 micro-batch]                  [本批次 4 features]
MVP-prod-launch-smoke ────┐
（Reviewer，~半天）        │
                          ├──────→ Demo 邀请发出（5-10 人）
F001 (seed 脚本) ─────────┤
F002 (用户文档) ──────────┤
F003 (演示脚本+录制) ─────┤
F004 (发放 runbook) ──────┘
```

**强依赖：**
- 本批次 F001-F004 缺一不可
- `MVP-prod-launch-smoke` done 是发邀请的硬前提（在独立 spec 中执行）

**推荐顺序：**
1. prod deploy 触发 → MVP-prod-launch-smoke 启动（Reviewer，平行）
2. F001 demo seed 脚本（Generator）
3. F002 + F003 并行（Generator 写文档 / Planner 起草脚本 + 用户录视频）
4. F004 发放 runbook（Planner）
5. prod-launch-smoke + F001-F004 全 done → 用户开始邀请 5-10 人

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
| F002 用户文档 6 文件（en/zh）+ PDF | ~1 day | Generator（结构）+ Planner（文案） |
| F003 演示脚本起草（视频录制由用户做，不计本批次工时） | ~0.3 day | Planner |
| F004 发放 runbook + safety checklist | ~0.5 day | Planner |
| 缓冲（安全 / 反复修文档） | ~0.5 day | — |
| **总计（本批次 4 features）** | **~2-2.5 day** | — |
| **平行 micro-batch** MVP-prod-launch-smoke | ~0.5 day | Planner+Reviewer |

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

**Spec 状态：** decisions-locked（2026-04-27 Planner 起草 + 用户裁决 5/5 全部落地，hotfix done 后切 planning → building）

**用户决策（2026-04-27 全部 ✅）：**
1. demo 周期 30 天 ✅
2. 首批种子用户数量 5-10 人 ✅
3. 邀请邮件发件人 marketer@kolquest.com（不新建 founder@） ✅
4. video walkthrough：Planner 起草脚本，**用户负责录制** ✅
5. F004 prod 烟测拆出独立 micro-batch ✅ → `docs/specs/MVP-prod-launch-smoke-spec.md`
