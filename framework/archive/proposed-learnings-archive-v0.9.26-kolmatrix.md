# Proposed-Learnings 归档 — v0.9.26-kolmatrix（fork-merge 清理）

> **归档背景（2026-07-13 fork-merge）：** joyce 采用 harness-template v1.0.3 结构重建时，`proposed-learnings.md` 新条目区遗留 11 条「用户已 ack 但未按 D7 步骤 4 清理」的 KOLMatrix provenance 条目。本档按 D7 步骤 4 将其全文移出新条目区归档，`proposed-learnings.md` header markers 块已加对应 done-marker。
>
> **知识落地位置：** 这些条目的知识已在 joyce v1.0.3 的 `framework/patterns/*.md`（web-runtime / deploy / database / ai-action-contract）+ `framework/harness/evaluator.md` 重植；本档仅保留 BL-id → 落地位置的审计轨迹。
>
> **术语与路径说明：** 正文按 fork-merge 约定将历史评审角色/工具名统一为 `Evaluator`。各条目「建议写入 / 状态」行记录的是 joyce **v0.9.26 期（v1.0 重构前）**的 `framework/harness/*.md` 落地位置（如 generator.md §13.1 / §15.3 / §19 / §20 / §21、evaluator.md §13.5、deploy-patterns.md §3.5 / §9 / §10），保留原文以存证；v1.0.3 布局下对应内容位于 `framework/patterns/*.md` 与 `framework/harness/evaluator.md`。

---

## [2026-06-05] Claude CLI — 来源:Planner Kimi BL-083 fork .env ops + 误并入 BL-082 在制 staged 文件

**类型：** 新坑（铁律 #12 实战反例）+ 模板修订（dry-run 验证 token 模式）

**内容：**

**子条目 A — 多角色并行 + Planner ops 后 git commit 误并入别人 staged 文件（铁律 #12 BIx 同款重演）：**
6/05 Planner 在 BL-082 building 期间执行 fork .env ops 后做 `git add .auto-memory/environment.md && git commit -m "docs(env): ..."`。**git status 显示左列 5 个 staged 文件（M/A 标记）来自 Generator/Reviewer 在制 BL-082 工作**（features.json + progress.json + docs/test-reports/BL-082-verifying-2026-06-05.md + tests/unit/kol-sync-daily.test.ts + project-status.md），但 Planner 只看自己 `git add` 的那一个就 commit，导致 5 个文件被 Planner 的 docs(env) commit 标签一并打包推 main（commit 97339c6）。**根因：** Planner 启动新 session 时未 `git status --short` 看左列 staged 索引，假设 staged 池=自己 add 的；铁律 #12 已警告但 Planner workflow 未把"开 session 先 grep staged"列为强制 checklist。**修复（commit 97339c6 不 revert，已 push + 内容合理）：** sediment 入 framework + 加 Planner-workflow checklist "session 开始 + git commit 前必 grep `git status --short` 看左列 staged"。

**子条目 B — fork .env token 配置必先 dry-run 验证（避免重蹈 invalid token 覆辙）：**
6/05 用户给 fork 端新 TIKHUB_TOKEN 让 Planner 配置。Planner 直接写 fork .env + restart 后才发现 TikHub API 返 "Invalid API token"，service restart 后 4-32s 内 99 次 TikTok scrape fail。Rollback 旧 token 恢复正常。后续 APIFY_API_TOKEN 配置前用 `curl -H "Authorization: Bearer <token>" https://api.apify.com/v2/users/me → HTTP 200` 先 dry-run 验证，成功避免二次踩坑。**沉淀：** 任何外部 API token 配置前应有 dry-run path —— Apify 用 `/v2/users/me`；其他 SaaS 有类似的 me/identity endpoint。fork .env 改前 ops 模板 = 备份 → dry-run 验 token → 改 → restart → 15s 窗口 grep 错误日志对比基线。

**建议写入：**
- `framework/harness/planner-workflow.md` §"会话启动" 加 step "git status --short 看左列 staged 池"
- `framework/harness/planner-checklists.md` §铁律 1 矩阵 加新行：v0.9.26 #1 "多角色并行 + Planner ops commit 前必 grep staged 索引"（铁律 #12 强化）
- `framework/harness/deploy-patterns.md` §ops template 加新段：external API token 配置前的 dry-run 验证模板（Apify /v2/users/me / TikHub TBD / 其他 SaaS me-endpoint）

**状态：** ✅ 2026-06-09 用户 ack，已沉淀入 `framework/harness/planner-workflow.md`（§0.0 会话启动 staged 索引）+ `framework/harness/planner-checklists.md`（铁律 1 矩阵 v0.9.26 #1）+ `framework/harness/deploy-patterns.md`（§1.8 external API token dry-run 模板）

---

## [2026-06-06] Claude CLI — 来源:Generator Kimi BL-084 fix-round 1 (Why dialog FAIL 根因)

**类型：** 新坑（客户端超时 vs LLM 真实延迟脱节）

**内容：**

BL-084 verifying staging FAIL 1「Why 详细解释暂时不可用」根因不是 env/代码逻辑缺失，而是 **DetailedExplanationDialog 客户端硬超时 5s（BL-067 设的）远小于 LLM 真实延迟 15-21s**。gateway 日志确认：evaluator 点 Why → EXPLAIN_DETAILED action `trc_rkxiis8qp4uyuvx53ioadsd2` 21.1s 后 status=success 并 write-through 缓存，但客户端 5s 已 setState error 显示错误态。该 bug 在 BL-067（campaigns/[id]）就潜伏，因 F005 short 预热 + 偶发 cache-hit 被掩盖；BL-084 match 面板无 detailed 预热故缓存未命中时 **100% 必现**。

**根本教训：** 任何 AI 调用的**客户端**超时必须 ≥ **服务端** runAigcAction timeoutMs，且应基于**真实延迟实测**（gateway 日志 list_logs 看 latency 分布）而非 roadmap 乐观假设（BL-067 假设 <5s P99，实测 4-20× 偏差）。多 locale × 多段 write-through payload（5×5=25 段 ≈4500 token）天然慢 ~20s，是延迟大头。

**衍生待评估（Planner 决策）：**
1. EXPLAIN_DETAILED / MATCH_RERANK 当前单次输出 ~4500-5700 token、~20s。detailed 可考虑只生成**当前 locale**（5 段 ≈900 token ~4s）+ 其余 locale 懒加载，换取 UX；但牺牲"一次调用预热 5 locale"。
2. MATCH_RERANK refresh 偶发 cosine 降级源于 LLM 返回非完美 30-排列（F002 strict permutation 校验）。可选 partial-merge（用 LLM 有效子集 + 缺失项按 cosine 补尾）替代 all-or-nothing 降级 —— 但改 F002 spec 契约，需 Planner ratify。

**建议写入：**
- `framework/harness/deploy-patterns.md` 或 `generator.md`：新增「AI 调用客户端超时 ≥ 服务端 timeoutMs，且基于 gateway list_logs 实测 latency 校准」铁律
- ADR 候选：多 locale write-through vs 单 locale 懒加载的延迟/成本权衡

**状态：** ✅ 2026-06-09 用户 ack，已沉淀入 `framework/harness/generator.md` §19（AI 客户端超时 ≥ 服务端 timeoutMs + list_logs 实测校准；含 ADR 候选）

---

## [2026-06-06] Claude CLI — 来源:Generator Kimi BL-086-F003 (manual_seed 充值前投喂会被 worker 即时消耗)

**类型：** 新坑（spec/诊断假设缺陷）+ 上游行为洞察

**内容：**

BL-086 诊断 + spec 假设"充值前把 2535 id POST /admin/seeds 入队 → 排队等充值 → 充值后真抓"。**实际不成立。** 读 apify fork SDK 源码确认：

1. fork scrape-worker `boss.work('scrape',…)` **持续运行**(非 daily cron 触发)，enqueue 的 manual_seed job **立即被处理**。
2. `youtube.getChannels()` 对每个 URL 的错误是 **per-url swallow**(`catch{ console.warn; }` 后 continue)，余额耗尽时 `get_channel_info` 抛错被吞 → 返回**空数组**。
3. manual-seed-scrape 拿到空数组 → `{inserted:0}` 不 throw → worker 判 job **`succeeded` inserted=0**(非 failed，pg-boss retryLimit=0 不重试)。

**净效果：充值前投喂 = job 全部 succeeded-0，id 被消耗，充值后不会重抓**(job 已 succeeded)，且投喂脚本 checkpoint 已标记 fed → 充值后须先清 checkpoint 才能重喂。**正解：manual_seed 全量投喂放到充值之后**；充值前验收用 dry-run(只读 count 2535/26 批) + 脚本就绪即可，不要真投。

**根本教训：** 凡"任务入队等外部资源就绪"的设计，必须先确认 **worker 是否会在资源未就绪时即时消耗任务**(消耗成 succeeded-0 / failed-no-retry)。诊断/spec 写"充值前入队"前应核 worker 生命周期 + 错误吞没行为(per-item swallow vs throw)。

**建议写入：**
- `docs/reviews/kol-acquisition-diagnostic-2026-06-06.md` 或 BL-086 spec §F003：修正"充值前入队"假设
- `framework/harness/generator.md`：新增"入队-等外部资源就绪 类设计须先验 worker 是否即时消耗"checklist 项

**状态：** ✅ 2026-06-09 用户 ack，已沉淀入 `framework/harness/generator.md` §20（入队等外部资源就绪类设计必先验 worker 是否即时消耗）。docs/reviews 诊断文档修正属项目文档，不在本次 framework sediment 范围

---

## [2026-06-06] Claude CLI — 来源:Generator Kimi BL-086 路径B sync /opt/apify-kol-service

**类型：** 新坑（fork sync 凭据缺口）+ ops 模板

**内容：**

路径 B "merge 上游 PR → sync /opt/apify-kol-service → rebuild" 的 sync 步骤踩两个坑：

1. **/opt/apify-kol-service 无 git 凭据拉 guang-tech/apify**：remote 是 HTTPS(私有仓)无 credential.helper；主机 deploy key `id_ed25519_github`(tripplemay, 仅 kolmatrix 权限)对 guang-tech/apify 返 "Repository not found"。→ 非交互 SSH 下 `git pull` 直接 fatal。**绕开方案(无 token 泄露)**：本地 `git bundle create x.bundle origin/master` → scp → prod `git fetch x.bundle origin/master`。

2. **/opt 有本地未提交 docker 定制**(`reset --hard` 会抹掉破坏部署)：`docker-compose.yml` 端口 `3000:3000→3004:3003`(nginx 上游)、`packages/service/Dockerfile` 加 `@apify-kol/apify` 包构建(index.ts 依赖, committed Dockerfile 没有)。**安全 sync 序列**：先确认 master 未改这两 committed 文件 → `git stash push -- docker-compose.yml packages/service/Dockerfile` → `git merge --ff-only FETCH_HEAD` → `git stash pop`(干净, 因 committed 版未变) → `docker compose up -d --build`。

验证新代码生效：`curl /admin/stats` 出现新字段(本次 `tikhubBalanceUsd:0.0005`)。

**建议写入：** `framework/harness/deploy-patterns.md` 新增「路径 B fork sync 模板：bundle 绕凭据 + stash/ff/pop 保本地 docker 定制 + /admin/stats 验新字段」。**长期修**：给主机配 guang-tech/apify 的 deploy key 或 fork remote 改 SSH, 免每次 bundle。

**状态：** ✅ 2026-06-09 用户 ack，已沉淀入 `framework/harness/deploy-patterns.md` §3.5（路径 B fork sync 模板）

---

## [2026-06-07] Claude CLI — 来源:Generator Kimi prod outage 恢复 (deploy build OOM 拖垮整机)

**类型：** 新坑（生产事故）+ 恢复 runbook + 防复发

**内容：**

**事故：** 2026-06-06 用户两次触发 deploy-prod.yml(15:58/17:40)均失败,报 `ssh: handshake failed: EOF`(部署跑 17 分钟后)。kol.guangai.ai 宕机至 6/07(HTTP 000, 端口 22+443 超时, SSH banner 阶段断)。staging 同 VM 一起挂。

**根因：整机系统内存耗尽。** 东京 VM(`instance-20260403-154049`, **仅 7.8Gi RAM**)同时跑 kolmatrix app + postgres + **aigcgateway 姊妹项目(4 cluster)** + **apify-kol-service docker(postgres+service)**。`deploy-prod.sh` 的 `node --max-old-space-size=4096 next build`(已限 V8 堆 4GB, 非 V8 OOM)叠加这些常驻服务把系统 RAM 打满 → 内核 thrash → sshd 握手都完不成 → 部署失败 + rollback 也连不上 → 主机卡死, 只能 GCP console reset。

**恢复 runbook(已验证):**
1. 用户 GCP reset VM(我无 gcloud, 无法做)。
2. reboot 后 pm2(systemd enabled)自动拉起, 但 **build OOM 中断留下 .next 残缺** → pm2 online 但 app 502。逐服务重建: `cd /opt/kolmatrix && NODE_ENV=production npx prisma generate && node --max-old-space-size=4096 ./node_modules/next/dist/bin/next build --webpack && pm2 reload kolmatrix`。staging(/opt/kolmatrix-staging)同样。
3. **apify docker reboot 后崩溃循环** `EAI_AGAIN postgres`(service 容器起在 postgres+网络就绪前): `cd /opt/apify-kol-service && docker compose up -d`(按 depends_on 顺序 + 重建网络; restart policy 单独不够)。

**防复发(待 Planner/ops 定):** VM 7.8Gi 跑 4 套服务 + 4GB build 严重超额。选项: (a)加 swap(OOM-killer 收割而非 thrash, 至少别拖死 SSH) (b)部署 build 时临时停 apify-docker 腾 RAM (c)扩 VM 内存 (d)CI runner 上 build 出 artifact 再传 VM, 不在 VM 上 build。**在此之前不要重试 prod 部署, 会再 OOM。**

**⚠️ 远端 bash heredoc 坑(本次反复踩):** SSH `bash -lc "..."` 里 echo 含括号 `(` 会 `syntax error near unexpected token`。远端 echo 一律不带括号。

**建议写入:** `framework/harness/deploy-patterns.md` §prod-outage-recovery + §VM 内存超额防护。

**状态：** ✅ 2026-06-09 用户 ack，已沉淀入 `framework/harness/deploy-patterns.md` §9（prod-outage-recovery + VM 内存超额防护：3 步恢复 runbook + 4 防复发选项 + heredoc 括号坑）

---

## [2026-06-08] Claude CLI (Kimi) — 来源：BL-097 部署 staging 首次失败

**类型：** 新坑（操作）

**内容：** `gh workflow run deploy-staging.yml -f ref=<短SHA>` 会在 `actions/checkout@v4` 步骤直接失败（`The process '/usr/bin/git' failed with exit code 1`），部署根本到不了 VM。根因：checkout@v4 用 `fetch-depth: 1` 浅拉取**指定 ref**，短 SHA（如 `04e5414`）不是可单独 fetch 的 ref，git 报错退出。`ref` 输入只能是**分支名/tag/完整 40 位 SHA**。改 `-f ref=main`（或完整 SHA）即过。误判风险：失败日志在 checkout 阶段，容易被误读成 VM 侧 build/OOM，实际连 VM 都没碰。

**建议写入：** `framework/harness/deploy-patterns.md` §部署触发 — ref 输入只用 main 或完整 SHA，禁短 SHA。

**状态：** ✅ 2026-06-09 用户 ack，已沉淀入 `framework/harness/deploy-patterns.md` §10（部署触发 ref 只用 main 或完整 SHA）

---

## [2026-06-08] Claude CLI (Kimi) — 来源：BL-080-F003 落地页视觉改动 push 后 CI 红

**类型：** 新坑（流程/CI 时序）

**内容：** F003 spec 把 L1 acceptance 写成「lint + tsc + vitest」，据此判定本地全绿即可 push。但本仓 `ci.yml` 在每次 push main 时**还跑完整 Playwright e2e + visual-regression**（landing-{en,zh}-{desktop,mobile} 四张 baseline + 功能断言）。任何改落地页视觉的 feature 一 push 即让 CI 红，直到：(1) 视觉 baseline 在 **Linux runner** 经 `update-visual-baselines.yml` workflow_dispatch 重拍（本地 mac/WSL 生成的 PNG 会因字体 hinting 差异在 CI diff，不可本地重拍）；(2) 因视觉改动失效的功能断言（如本次删 hero video → `landing-hero-video` 断言）同步更新。两个连带坑：① bot 用 `GITHUB_TOKEN` push 的 baseline commit **不触发 CI**（GitHub loop 防护），须手动 `gh workflow run ci.yml` 验证 HEAD；② Docker Hub 偶发 `docker pull pgvector 500` 让 service-container init 挂，非代码问题 → `gh run rerun <id> --failed`。另一边界争议：删 video 导致的 e2e 断言更新本属 Evaluator 测试域，但 CI 红阻塞 main 时 Generator 被迫改测试——建议 spec 对「改视觉的 feature」显式把 baseline 重拍 + 连带断言更新纳入**同一 feature 的 acceptance**，而非拆到后续 F005/F006，避免 main 中途红。

**建议写入：** `framework/harness/generator.md` §15（Perf/image 落地段邻近）补「视觉改动 feature 的 CI 时序」；或 `framework/harness/deploy-patterns.md` §CI baseline 重拍时序 + bot commit 不触发 CI + Docker Hub 500 rerun。

**状态：** ✅ 2026-06-09 用户 ack，已沉淀入 `framework/harness/generator.md` §21（改落地页视觉 feature 的 CI 时序 — baseline 须 Linux runner 重拍）+ cross-ref `framework/harness/deploy-patterns.md §4.1`（已有 bot commit 不触发下游 workflow 段，未重复新建）

---

## [2026-06-10] Claude CLI (Kimi) — 来源：BL-108-F004 verifying fix-round 1（监控页开关点击失效 React #418）

**类型：** 新坑（前端水合）+ 建议补 Generator/Evaluator checklist

**内容：** `'use client'` 组件在**初始 SSR 渲染路径**里调用 `new Date(iso).toLocaleString()`（或任何依赖运行时时区/locale 的格式化，如无显式 `timeZone` 的 `Intl.DateTimeFormat`/`toLocaleDateString`），SSR 在服务器时区生成文本、客户端水合时按浏览器时区重渲 → 文本节点不一致 → React minified **#418 水合失配** → React 丢弃该 hydration root 的整棵服务端树并客户端重渲。**致命连带：失去交互的不只是那个时间戳——同一 root 内所有控件的事件处理器都来不及/不再正确绑定**（本例两个暂停开关 onClick 全失效，headless Playwright 点击无任何反应，console 仅留一行 #418）。极易误诊为"开关逻辑 bug"而去查 onClick/state，实则根因在一个看似无害的时间戳渲染。**修复**：用 `getUTC*` 手写确定性 `YYYY-MM-DD HH:mm UTC`（服务端/客户端逐字符一致，UTC 也合 ops 监控页口径）；或 mount-gate（`useState(false)`+`useEffect` 后再渲本地时间，SSR 期渲占位）；或 `suppressHydrationWarning`（仅文本节点级，最弱）。**回归测试**可确定性化：断言渲染输出为固定 UTC 串（非 `toLocaleString` 的 `/`、`,`、`AM/PM`），`TZ=America/New_York npx vitest` 实证 fail-before/pass-after。**潜伏面**：本仓另有 `RoiInsightsPanel`/`AiSuggestionsClient`/`UsedInTab` 等多处 client `toLocaleString`，目前仅因"在用户交互后才渲染、不进初始 SSR"而侥幸不炸——一旦被挪进初始渲染即同病。

**建议写入：** `framework/harness/generator.md` §15（Perf/image/Suspense 落地段邻近，同属"客户端渲染正确性"）补「client 组件初始 SSR 渲染禁非确定性时间/locale 格式化（#418 会废掉整个 hydration root 的交互）+ 确定性 UTC/mount-gate 三选一 + 确定性回归」；`framework/harness/evaluator.md` §13 测试设计补「带交互的 client 页面 L2 必跑 headless 点击并断言 console 无 React #418/#425 水合错误」。Planner spec 起草含交互的 client 页面时把"无水合错误"列入 acceptance。

**状态：** ✅ 2026-06-12 用户 ack，已沉淀入 `framework/harness/generator.md §15.3`（客户端水合正确性 — 子坑 A 水合失配/#418）+ `framework/harness/evaluator.md §13.5`（含交互 client/SSR 页面 L2 必跑 headless 点击断言无 #418/#425）。与下一条（时序窗口）合并为「客户端水合正确性」一节两子坑

---

## [2026-06-10] Claude CLI (Kimi) — 来源：BL-108-F004 reverify fix-round 2（#418 修好后开关点击仍失效）

**类型：** 新坑（前端水合时序）+ Evaluator 测法铁律 + Generator mount-gate 模式

**内容：** 上一条（#418 水合失配）修好后，Evaluator reverify 发现开关点击**仍**不生效，但已无任何 console 错误——这是**另一个独立根因：水合时序竞态**。SSR 把交互按钮渲进 HTML 后，到 React 完成水合、给 onClick 绑定事件之间有一段延迟窗口（staging 实测开关 DOM @728ms 出现、onClick @1253ms 才绑定，窗口 ~525ms；弱机/慢网更长）。**这个窗口里按钮可见、可 focus、可点，但事件未绑定**；窗口内的点击被**永久丢弃**，且 **React 18+ 的 discrete-event replay 在 Next.js App Router 这种 RSC+client-island 场景不补触发**（staging 实测 trusted click 等 3s 也不重放）。这是**真实面向用户的 bug**（用户在页面加载后 ~1s 内点关键控件会点了个寂寞），不是纯测试问题。**为什么极难诊断**：jsdom 下 RTL `render()` 是纯客户端渲染、从不经过 SSR+hydrate，单测全绿；只有真实浏览器（或 `renderToString`→`hydrateRoot` 测试）才暴露。**修复模式（mount-gate）**：用 `useSyncExternalStore(()=>()=>{}, ()=>true, ()=>false)`（server=false/client=true，水合安全、且避开 `react-hooks/set-state-in-effect` 规则——`useState(false)+useEffect(setReady(true))` 会被该规则报错）做客户端就绪检测；水合完成前关键控件 `disabled` + 根节点 `data-ready=false` + 显示"初始化中"，完成后 enabled。使「控件可点 ⟺ 已水合」：真实用户见诚实未就绪态，Playwright 标准 `click()` 自动等 enabled 跨过窗口。**Evaluator 测法铁律（关键）**：测含交互的 SSR 页面，**必须用标准 `locator.click()`（自动等 actionability/enabled）或显式 `await [data-ready=true]` 再点**；**严禁 `force:true` / `dispatchEvent` / `evaluate(el=>el.click())`**——这些跳过 enabled 检查，会点在未水合的按钮上、稳定复现"假 bug"（Evaluator 两轮 reverify 即因落此窗口而误判）。**回归**：`renderToString`→`hydrateRoot` 路径断言「SSR 阶段 disabled / 水合后 enabled+可点」（RTL `render` 测不到）。

**建议写入：** `framework/harness/generator.md` §15 补「mount-gate 模式：SSR 关键交互控件水合前 disabled + data-ready 信号（useSyncExternalStore 实现，避开 set-state-in-effect）+ renderToString/hydrateRoot 回归」；`framework/harness/evaluator.md` §13 **铁律级**补「含交互 SSR 页面 L2 用标准 click（自动等 enabled）或 await data-ready，严禁 force/dispatch/evaluate-click —— 否则会稳定复现水合窗口假 bug」。与上一条（#418）合并为「客户端水合正确性」一节的两个子坑（失配 vs 时序窗口）。

**状态：** ✅ 2026-06-12 用户 ack，已沉淀入 `framework/harness/generator.md §15.3`（客户端水合正确性 — 子坑 B 时序窗口 + mount-gate useSyncExternalStore 模式）+ `framework/harness/evaluator.md §13.5`（铁律级：标准 click/await data-ready，严禁 force/dispatch/evaluate-click）。与上一条 inline-merge 为两子坑单节

## [2026-06-11] Claude CLI (Kimi) — 来源：BL-100 F001/F003（BullMQ 化邮件异步队列）

**类型：** 新坑（BullMQ 集成）+ 环境 caveat + Generator 后台任务模式

**内容：** 把 InMemoryJobQueue swap 成真 BullMQ（同 JobQueue 接口）踩到三个非显然点，建议沉淀给后续任何"接 BullMQ / 后台队列"批次：
① **Worker 连接必须 `maxRetriesPerRequest: null`**：BullMQ v5 的 Worker 用阻塞命令（BRPOPLPUSH/BZPOPMIN），构造时若 connection 的 `maxRetriesPerRequest` 非 null 直接抛错。本仓 `getRedis()`（rate-limit/health 用，retries:3）**不能直接复用给 Worker**——新增 `getBullConnection()`（retries:null, enableReadyCheck:false）；Queue 生产者共享它，每个 Worker 用 `.duplicate()` 拿专用阻塞连接（阻塞 socket 不能与生产者 socket 混用）。spec/ADR 写"以 getRedis() 为后端"应理解为"同 Redis 实例"而非"同 client 对象"。
② **D5 回退的 enqueue fast-fail 与 null-retries 冲突**：retries:null 让 `queue.add()` 在 Redis 挂时**无限重试不返回**，与"入队失败→回退同步发"矛盾。解法：`add()` 内 `Promise.race` 包 5s timeout 强制 reject，上层 catch→同步兜底。残留风险：超时被放弃的 enqueue 若 Redis 恢复后才落地会造成重复 job——靠业务层幂等（本例 email_log (batchId,kolId) 发前查跳已发）兜住，**故"队列幂等"要做在 handler/业务层而非依赖 BullMQ jobId 去重**（jobId 去重仅在 job 仍驻留时有效，removeOnComplete 后失效）。
③ **环境 caveat：prod/staging VM Redis = 6.0.16 < BullMQ 推荐 6.2.0**。core add/process/retry/delay/jobId-dedup 在 6.0 可用（staging boot 见 4× "minimum Redis version 6.2.0" 警告=连接已建非错误），但 BullMQ 部分高级特性（debounce/部分 rate-limiter）需 6.2。本批未用这些，Evaluator L2 须实测 enqueue→consume 端到端通；若未来用到高级特性需先升 Redis。建议 Planner 评估是否把 Redis 升级列入环境待办 + environment.md 记 BullMQ 版本约束。

**建议写入：** `framework/harness/generator.md` §13（InMemoryJobQueue 段邻近）补「升 BullMQ 的连接拓扑铁律：getBullConnection retries:null + 每 Worker .duplicate() + 生产者共享」+「D5 enqueue timeout + 业务层幂等而非 jobId 去重」；`framework/harness/database-patterns.md` 或 `environment.md` 记 Redis 6.0.16 < BullMQ 6.2 推荐的约束。

**状态：** ✅ 2026-06-11 用户 ack，已沉淀入 `framework/harness/generator.md §13.1`（升 BullMQ 连接拓扑铁律：getBullConnection retries:null + 每 Worker .duplicate() + enqueue timeout race + 业务层幂等）+ `.auto-memory/environment.md` Staging 表后 Redis 版本约束 note（6.0.16 < BullMQ 6.2 推荐）

## [2026-06-12] Claude CLI (Kimi) — 来源：BL-105-F001 CI 红（新建 route page）

**类型：** 新坑（Next App Router build）+ Generator 验证铁律补充

**内容：** 新建/修改 App Router `page.tsx`（或 layout/route）的 feature，**本地 `tsc --noEmit` + `npm run lint` 全绿 ≠ `next build` 绿**。BL-105-F001 在 `campaigns/[id]/edit/page.tsx` 里 `export function editErrorLabels(...)`（一个共享 helper），tsc/lint 都不报，但 `next build` 的 "Build + migrate smoke" job 直接 fail——**Next App Router 的 page/layout/route 文件只允许 export `default` + 路由 segment config（`metadata`/`generateMetadata`/`dynamic`/`revalidate`/`fetchCache`/`runtime`/`preferredRegion` 等），任何其它命名 export 触发 build error**。修复：把 helper 抽到同目录普通模块（`error-labels.ts`）再 import。**根因**：这是 Next 的构建期 RSC 约束校验，不在 TS 类型系统内，故 tsc 漏报；lint 也无对应 rule。

**配套铁律建议**：Generator 完成"新建 route segment 文件（page/layout/route/template/default/loading/error/not-found）"类 feature 时，**commit 前必须本地跑一次 `npm run build`**（不能只靠 tsc+lint+vitest）。CI 的 build job 会抓，但本地先跑省一轮 main 红 + 一次 staging deploy 前的返工。同类还会抓：'use server' 文件非 async export（generator.md §14.2 已记）、client/server 边界 props 不可序列化、动态路由 generateStaticParams 缺失等——都是 build-only。

**建议写入**：`framework/harness/generator.md` §"切 verifying 前" 或 §14 邻近补「新建 route segment 文件 feature 的 commit 前 `npm run build` 自检铁律 + Next page 文件合法 export 白名单」；与 §14.2（'use server' 非 async export）合并为「Next 构建期约束（tsc/lint 漏报）」一节。

**状态：** ✅ 2026-06-12 用户 ack，已沉淀入 `framework/harness/generator.md §14.4`（新建/改 route segment 文件 feature commit 前必跑 `npm run build` 铁律 + page 文件合法 export 白名单），并在 §14.2 头加「Next 构建期约束（tsc/lint 漏报）」共性框统辖 §14.2+§14.4
