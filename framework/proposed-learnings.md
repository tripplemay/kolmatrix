# Framework 提案暂存区

> Generator 和 Evaluator 在工作中发现值得沉淀的经验时，追加到本文件。
> Planner 在 done 阶段读取本文件，逐条提交给用户确认。
> 确认后由 Planner 正式写入 `framework/` 对应文件，并在 `CHANGELOG.md` 追加记录，最后从本文件移除已确认条目。
> 已闭环条目归档到 `framework/archive/proposed-learnings-archive-vX.Y.md`。

---

## 写入流程（D7 + D8 lock，BL-071 F007）

sediment（沉淀）从 proposed-learnings.md 走向 `framework/harness/*.md` 的标准路径。本节是 D8 lock 把"散落在多个角色文件 + 经验记忆"的沉淀工作流统一到 proposed-learnings.md header 一处的产物。

### 4 步流程

| 步 | 谁做 | 何时 | 产物 |
|---|---|---|---|
| **1. propose** | Generator / Evaluator | 批次 building / verifying / fixing / reverifying 任意阶段发现 | 追加 entry 到 `framework/proposed-learnings.md` 末尾（line 40 起新条目区），格式见下 |
| **2. 用户 ack** | 用户 | done 阶段 Planner 逐条提交时 / 即时对话中 | 用户回复"ack"或等同措辞；含修订意见时 entry 文字按意见修订后再 ack |
| **3. inline-merge** | Planner | done 阶段（或独立 framework sediment batch） | 按 D7 inline-merge 规则写入 `framework/harness/*.md` 对应 topic 段（不是 chronological-append §N，详见下文） |
| **4. archive** | Planner | inline-merge 完成同 commit | 归档 entry 全文到 `framework/archive/proposed-learnings-archive-vX.Y.Z.md` + 加 `<!-- vX.Y.Z 沉淀完成 -->` HTML 注释到本文件 header markers 块 + 从新条目区移除原 entry + `framework/CHANGELOG.md` 顶部新增 vX.Y.Z 段 1-line summary |

### D7 inline-merge 强制规则（禁 chronological-append §N）

**核心：** 新 sediment 必须找贴近的 topic 段合并，**不得**通过追加 `§N` chronological 段落落地。

**inline-merge 优先级（从高到低尝试）：**

1. **合并矩阵行：** 目标文件已有矩阵/表格（如 planner-checklists.md 铁律 1 矩阵 / generator.md 测试边界矩阵）→ 新规律若属同一维度，直接加新行
2. **加子段：** topic 段已存在但新内容是该 topic 的延伸 / 反例 / 实战 → 加子段 §X.Y（如 deploy-patterns.md §3.2 加 §3.2.1 staging deploy 前置 git pull）
3. **修订段内文字：** 新内容是对已有规则的细化 / 边界澄清 → 直接修订段内某段文字（如 evaluator.md §11.1 fire-and-forget 段加一句"或 vi.waitFor 50-100ms retry"）
4. **开新 topic 段（最后手段）：** 仅当上述 3 个都不适用 — 即新 sediment 真的代表一个全新维度，topic 在现有文件中无对应位置 → 开新 ## 段

**反模式：** 追加 `## §N. 新规律 X` 到文件末尾时间序排，这是 v0.9.22 之前的旧习。BL-071 audit §3.1 暴露 evaluator.md §10-§20 11 段时间序最严重。

### sediment 类型分类

| 类型 | 含义 | 典型写入位置 |
|---|---|---|
| **新规律** | 跨多批次复现的稳定模式 | 合并入矩阵 / 加子段 |
| **新坑** | 单次踩坑但有借鉴价值 | "踩坑列表"段 / 反例段 |
| **模板修订** | 已有 spec / signoff / acceptance 模板需调整 | 直接 inline 改原段 |
| **铁律补充** | 升级 harness-rules.md 铁律列表（影响所有项目） | `harness-rules.md` 新增/修订铁律 + 必须用户书面 ack + framework-generic 抽象后 port template |

### 写入位置决策树

```
是 sediment 还是？
├─ 否 → 不进 proposed-learnings.md，可能进 ADR 或 spec 反例段
└─ 是
   ├─ 影响所有项目（铁律级）？
   │  ├─ 是 → harness-rules.md 铁律 + 用户书面 ack 才能 port template
   │  └─ 否
   │     ├─ 影响多角色？
   │     │  ├─ 是 → 多文件同步（按角色 cross-ref 矩阵）
   │     │  └─ 否 → 单角色文件
   │     └─ 项目特定 vs framework-generic？
   │        ├─ 项目特定 → 当前项目根 + framework-generic template 不动
   │        └─ framework-generic → 项目根 + framework-generic template 同步
   └─ 是 ADR-worthy（跨批次影响 / 不可逆 / 当时辩论过的关键决策）？
      └─ 是 → 加 ADR 文件 + 引用 proposed-learnings entry 作为来源
```

### Entry 格式（追加到本文件新条目区）

```markdown
## [YYYY-MM-DD] {Claude CLI / Codex / Generator agent-id} — 来源：{触发场景简述：批次 ID + feature ID + fix-round 编号 / audit 名}

**类型：** 新规律 / 新坑 / 模板修订 / 铁律补充

**内容：** [一句话总结 → 多段详述 → 含具体 commit hash / file:line / 反例 case]

**建议写入：** `framework/harness/{file}.md` §{具体段名 or 矩阵行编号} / 配套 cross-ref / 同主题合并提示

**状态：** 用户 YYYY-MM-DD 已 ack — 待 done 阶段 / 专门 framework sediment batch 正式写入
```

---

<!-- 2026-05-04: v0.9.9 沉淀完成（8 条 learnings 来源 BL-030/BL-031/BL-032），全部已写入 framework/ 对应文件 + CHANGELOG。 -->

<!-- 2026-05-04: v0.9.10 沉淀完成（3 条 learnings 来源 BL-033 + prod-mvp-readiness-audit），全部已写入 framework/ 对应文件 + CHANGELOG。 -->

<!-- 2026-05-05: v0.9.11 沉淀完成（5 条 learnings 来源 BL-020 + backend-full-scan-2026-05-04 audit），全部已写入 framework/ 对应文件 + 项目根 .nvmrc + .auto-memory/environment.md + CHANGELOG。归档：framework/archive/proposed-learnings-archive-v0.9.11.md。 -->

<!-- 2026-05-05: v0.9.12 沉淀完成（3 条 learnings 来源 BL-034），全部已写入 pre-impl-adjudication.md §11 + database-patterns.md §8.1 + deploy-patterns.md §5 + evaluator.md §17 + CHANGELOG。归档：framework/archive/proposed-learnings-archive-v0.9.12.md。 -->

<!-- 2026-05-06: v0.9.13 沉淀完成（2 条 learnings 来源 BL-024），全部已写入 deploy-patterns.md §5.1 + ai-action-contract.md §4.7 + CHANGELOG。归档：framework/archive/proposed-learnings-archive-v0.9.13.md。 -->

<!-- 2026-05-06: v0.9.14 沉淀完成（2 条 learnings 来源 BL-040 + BL-041 audit 过期 + BL-043 staging fix），全部已写入 planner.md 铁律 1 矩阵 +2 行延伸 + deploy-patterns.md §1.7（v0.9.7 §1.6 范围扩展）+ CHANGELOG。归档：framework/archive/proposed-learnings-archive-v0.9.14.md。 -->

<!-- 2026-05-07: v0.9.15 沉淀完成（2 条 learnings 来源 BL-021 F002 撤再翻盘 + BL-049 测试基建 audit），全部已写入 planner.md 铁律 1 矩阵 +2 行（v0.9.15 #1 跨 pool 复现 + #2 stub environment-agnostic）+ CHANGELOG。归档：framework/archive/proposed-learnings-archive-v0.9.15.md。 -->

<!-- 2026-05-08: v0.9.16 沉淀完成（1 条 learning 来源 BL-052 verifying P5 裁决），全部已写入 planner.md §"Planner 裁决职责" §P5.2 段 + CHANGELOG。归档：framework/archive/proposed-learnings-archive-v0.9.16.md。 -->

<!-- 2026-05-08: v0.9.17 沉淀完成（1 条 learning 来源 BL-012 apify-kol fork audit），全部已写入 planner.md 铁律 1 矩阵 +1 行（v0.9.17 记忆条目陈旧风险）+ 反面案例段（BL-012 5/7→5/8 实战）+ CHANGELOG。归档：framework/archive/proposed-learnings-archive-v0.9.17.md。 -->

<!-- 2026-05-08: v0.9.18 沉淀完成（1 条 learning 来源 BL-012 F001 fix-round 1 admin role enum mismatch），全部已写入 planner.md 铁律 1 矩阵 +1 行（v0.9.18 auth role enum 实物核查）+ CHANGELOG。归档：framework/archive/proposed-learnings-archive-v0.9.18.md。 -->

<!-- 2026-05-08: v0.9.19 沉淀完成（1 条 learning 来源 BL-012 F002 fix-round 2 prod zod schema mismatch），全部已写入 planner.md 铁律 1 矩阵 +1 行（v0.9.19 external API response zod schema 实物 sample 验证）+ CHANGELOG。归档：framework/archive/proposed-learnings-archive-v0.9.19.md。 -->

<!-- 2026-05-10: v0.9.20 沉淀完成（1 条 learning 来源 BL-060 fix-round 1→2 e2e suite-level isolation vs 单 case 信号区分），写入 .auto-memory/role-context/evaluator.md §"E2E suite 稳定性诊断" + .auto-memory/role-context/generator.md §"扩范围 vs 单点修的判断"。后续 batch 候选（抽 tests/e2e/helpers/auth.ts + global-setup.ts + storageState 复用）入 backlog 跟踪。归档暂未写 framework/archive/proposed-learnings-archive-v0.9.20.md（git history 已有 commits cae1f8f / 821c094 完整记录）。-->

<!-- 2026-05-14: v0.9.21 沉淀完成（4 条 learnings 来源 BL-064 fix-round 3 + BL-065-R1 + BL-065-F006 + BL-065-F007 fix-rounds=1），全部已写入：planner.md 铁律 1 矩阵 +1 行（v0.9.21 i18n template 路由迁移）+ §fix-rounds 数解读；generator.md §9 IA refactor redirect scope + §10 大型删除批次执行模板；evaluator.md §20 L1+角色门禁手动探针；同步 .auto-memory/role-context/{generator,planner,evaluator}.md 短摘要 + CHANGELOG。归档：framework/archive/proposed-learnings-archive-v0.9.21.md。 -->

<!-- 2026-05-17: v0.9.22 沉淀完成（13 条 learnings 来源 BL-066 done 3 条 + BL-067 done 5 条 + BL-068 done 5 条），中等深度沉淀模式：archive 完整 13 条全文 + CHANGELOG 完整 13 条 1-line summary + cross-reference 待写入文件；framework/harness/*.md 实际段落起草（估 12 段 × 30-80 行）**留独立 framework batch 或合并 v0.9.23 一并沉淀**，避免 v0.9.22 commit 范围过大冲淡 BL-069 节奏。归档：framework/archive/proposed-learnings-archive-v0.9.22.md。待写入位置详见归档 §4 / CHANGELOG v0.9.22 段表。 -->

<!-- 2026-05-25: v0.9.23 沉淀完成（31 条 = v0.9.22 13 + BL-069 3 + BL-070 12 + audit §5 缺失 3）—— BL-071 F008 按新结构 inline-merge 全部写入 framework/harness/*.md：ai-action-contract.md 3 段（§3.4 dedupe-then-validate + §3.5 prompt 自检 § + §5 SDK 抽象层）/ generator.md 13 段（§10D IaRedirectRule mixed-status + §11 F-I 4 子段 UUID guard/notFound HTTP/i18n ns caller/lazy fidelity + §12 audit工具链 3 段 + §13 InMemoryJobQueue + §14 编译时约束 2 段 + §15 perf 2 段含 #29+#30 合并）/ evaluator.md 3 段（§13.1 量化 criterion + §13.2 mock 不可用三件套 #12+#21 合并 + §13.3 staging chaos flag）/ pre-impl-adjudication.md 2 段（§6.4 建议命中率 + §11 多 audit 串联）/ deploy-patterns.md 3 段（§4.1 扩展 bot commit + §3.2 git pull inline + §7 Turbopack BUILD_ID）/ planner-workflow + arbitration + checklists 5 段（§P5.3 verifying trace + fix-round 类型 + session_notes + commit message + perf #25+#26 合并）。归档：framework/archive/proposed-learnings-archive-v0.9.23.md（F009 创建）。 -->

<!-- 2026-05-27: v0.9.24 沉淀完成（17 条 sediment 来源 BL-072 done 4 + BL-073 done 5 + BL-075 done 4 + BL-076 done 4），全部已写入 framework/harness/*.md（5 同主题合并 + 13 实际段：ai-action-contract.md §6 AI 经济与速率防御 #11+#12 / generator.md §11 J 删 X grep 矩阵 #4 + §14.3 Schema rollback cross-ref #16 + §16 batch try/catch #15 + §17 adapter check #17 / evaluator.md §13.4 advisory test 三件套 #3+#7+#9 / deploy-patterns.md §1.6.1 SSH env var pm2 #10 + §8 log-based alerting #8+#14 / planner-checklists.md §IA outbound 扫描 #1 + §嵌套 grep #6 / database-patterns.md §4.6 platform_admin RLS #13 + §9 Schema rollback #16 主写 / checklists/material-symbols-pattern.md §Pattern v1→v2→v3 #2+#5）。归档：framework/archive/proposed-learnings-archive-v0.9.24.md。BL-077 sediment batch implementing。 -->

<!-- 2026-05-27: v0.9.25 沉淀完成（5 条 sediment 来源 BL-078 done），全部已写入 framework/harness/*.md（1 同主题合并 #1+#5 motion a11y 三件套 + 4 实际段：evaluator.md §11.6 motion a11y 三件套 #1+#5 / ui-fidelity-guardrail.md §3.4 landing visual token layer 规范 #2 / generator.md §18 现代 CSS 渐进增强 #3 / planner-checklists.md §"Visual polish reference URL 提炼方法论" #4）。归档：framework/archive/proposed-learnings-archive-v0.9.25.md。 -->

---

<!-- 新条目从这里开始追加 -->

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

**状态：** 待用户 ack — 待 done 阶段 / 专门 framework sediment batch 正式写入

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

**状态：** 待用户 ack

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

**状态：** 待用户 ack（F003 投喂时机用户决策中）

---

## [2026-06-06] Claude CLI — 来源:Generator Kimi BL-086 路径B sync /opt/apify-kol-service

**类型：** 新坑（fork sync 凭据缺口）+ ops 模板

**内容：**

路径 B "merge 上游 PR → sync /opt/apify-kol-service → rebuild" 的 sync 步骤踩两个坑：

1. **/opt/apify-kol-service 无 git 凭据拉 guang-tech/apify**：remote 是 HTTPS(私有仓)无 credential.helper；主机 deploy key `id_ed25519_github`(tripplemay, 仅 kolmatrix 权限)对 guang-tech/apify 返 "Repository not found"。→ 非交互 SSH 下 `git pull` 直接 fatal。**绕开方案(无 token 泄露)**：本地 `git bundle create x.bundle origin/master` → scp → prod `git fetch x.bundle origin/master`。

2. **/opt 有本地未提交 docker 定制**(`reset --hard` 会抹掉破坏部署)：`docker-compose.yml` 端口 `3000:3000→3004:3003`(nginx 上游)、`packages/service/Dockerfile` 加 `@apify-kol/apify` 包构建(index.ts 依赖, committed Dockerfile 没有)。**安全 sync 序列**：先确认 master 未改这两 committed 文件 → `git stash push -- docker-compose.yml packages/service/Dockerfile` → `git merge --ff-only FETCH_HEAD` → `git stash pop`(干净, 因 committed 版未变) → `docker compose up -d --build`。

验证新代码生效：`curl /admin/stats` 出现新字段(本次 `tikhubBalanceUsd:0.0005`)。

**建议写入：** `framework/harness/deploy-patterns.md` 新增「路径 B fork sync 模板：bundle 绕凭据 + stash/ff/pop 保本地 docker 定制 + /admin/stats 验新字段」。**长期修**：给主机配 guang-tech/apify 的 deploy key 或 fork remote 改 SSH, 免每次 bundle。

**状态：** 待用户 ack
