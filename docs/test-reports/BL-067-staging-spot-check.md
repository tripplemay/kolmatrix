# BL-067 Staging Dogfood Spot Check 清单

> **起草：** 2026-05-15 北京 / Planner johnsong
> **批次：** BL-067-explainability-c3（F007 reviewer 段 spot check checklist）
> **触发条件：** Generator 段 7/7 done @ `fbc836a` + staging deploy 完成 + actions registered (short=`cmp6ifb5w0035bnrrljflmtcn` / detailed=`cmp6ihdt109jebnrqdj215aft`)
> **执行者：** Codex evaluator (Reviewer)
> **状态：** Pending — Reviewer 接 verifying 阶段后逐项跑，将结果填入对应表格 + 完工时 commit 落 `docs/test-reports/BL-067-signoff-2026-05-XX.md`
> **关联：** BL-067 spec §F007 acceptance / Generator handoff in `progress.json.session_notes.johnsong_generator`

---

## §1 核心 short explanation 渲染（≥5 个不同游戏品类 campaign）

**目的：** 验证 F005 BullMQ-style worker 走 InMemoryJobQueue + delay:1 fire-and-forget 模式下，AiRecommendationPanel mount 后 ~10-30s 内 top 30 KOL 全部完成 short LLM 生成 + 写 asset cache + 后续 reload 命中 short 渲染。

**执行步骤：**
1. SSH staging → 跑 SQL `SELECT id, name, markets FROM campaign WHERE status='active' ORDER BY created_at DESC LIMIT 20` 选 5 个不同 game category 的 campaign（覆盖 MMORPG / FPS / Mobile / Casual / Indie 至少 4 种）
2. 用 marketer staging 账号（`marketer@kolmatrix.local` / `KOLMatrix@2026!`）登录 `https://staging.kol.guangai.ai`
3. 依次进入 5 个 campaign `/en/campaigns/{id}`
4. 第 1 次进入：观察 AiRecommendationPanel skeleton → smart-match top 30 → 短解释占位（C2 fallback）→ 等 ~30s → reload
5. 第 2 次 reload：观察 30 张 KOL 卡片是否显 LLM 生成的 short（非 C2 字符串 `cosine match X | valueScore Y`）

**Acceptance criteria：**

| Campaign # | Game category | top 30 KOL 全显 LLM short？ | LLM 短解释引用 ≥3 个 4 维度信号？ | 句法通顺中文质量 ≥80%？ | 备注 |
|---|---|---|---|---|---|
| 1 | (TBD) | ☐ | ☐ | ☐ | |
| 2 | (TBD) | ☐ | ☐ | ☐ | |
| 3 | (TBD) | ☐ | ☐ | ☐ | |
| 4 | (TBD) | ☐ | ☐ | ☐ | |
| 5 | (TBD) | ☐ | ☐ | ☐ | |

**失败处置：**
- LLM short 不渲染（全 C2 fallback）→ SSH 查 audit_log `WHERE action='ai_recommendation.explain_short_generated' AND tenant_id={tenantId} ORDER BY created_at DESC LIMIT 30` 验是否真有 pre-warm 调用；如无 → 查 pm2 logs 看 `explain-recommendations-worker` worker 报错 / cost-cap 满
- 部分 KOL 显 LLM 部分显 C2 → 看 audit_log payload `costUsd` 累计是否达 cap $5；或网络抖动逐个 retry
- 句法/质量低 → 记录 5 个最差案例 commit 到 signoff doc，**评估 fix-round 升级 prompt** (audit §1:A 风险表项 "LLM 输出质量低于预期")

---

## §2 Detailed dialog 5 段质量（≥3 个 detailed dialog 实测）

**目的：** 验证 F004 DetailedExplanationDialog 首次打开走 `requestDetailedExplanationAction` → cache miss → LLM 详细 5 段生成 → 写 asset → 渲染；二次打开走 cache hit 不 LLM。

**执行步骤：**
1. §1 完成 1 个 campaign 后，在 AiRecommendationPanel 选择 3 个 KOL（推荐：top 3 / mid / bottom 各 1）
2. 点 KOL 卡右上 `help_outline` `?` icon
3. 观察 Dialog 打开 → Loading skeleton 5 段骨架（≤5s）→ 5 段 LLM 内容渲染（matchScore / categoryFit / recentActivity / audienceFit / brandHistory）
4. 关闭 Dialog → 同 KOL 二次打开（5s 内）→ 应立即渲染（cache hit，无 skeleton stall）

**Acceptance criteria：**

| KOL # | 5 段全渲染？ | 首次打开 ≤5s 完成？ | 二次打开 cache hit（无 skeleton）？ | 5 段内容引用具体数据（不是空话）？ | 备注 |
|---|---|---|---|---|---|
| 1 (top) | ☐ | ☐ | ☐ | ☐ | |
| 2 (mid) | ☐ | ☐ | ☐ | ☐ | |
| 3 (bottom) | ☐ | ☐ | ☐ | ☐ | |

**失败处置：**
- 5s timeout fallback "AI 解释暂不可用" 文案 → 看 audit_log 是否记 `ai_recommendation.explain_detailed_generated` 失败；多次出现则疑 token 超限或 aigcgateway 慢
- cache hit 二次仍 LLM 调用 → 查 asset 表 `WHERE name LIKE 'explain-detailed/%/{kolId}/{locale}'` 是否真写入；若有则 dialog cache 读逻辑错（fix-round）
- 5 段内容空泛（如"该 KOL 很优秀"）→ 提示 prompt 需要更明确"必须引用 follower/engagement/category/brand history 具体数字"

---

## §3 5 locale 切换 spot check

**目的：** 验证 F001 prompt 设计的 1 次 LLM call 输出 5 locale JSON 在 i18n 切换时显对应语言内容，cache key 三元组 `(campaignId, kolId, locale)` 命中正确。

**执行步骤：**
1. §1 完成 1 个 campaign（其 top 30 已 pre-warm 完成）
2. URL 切到 `/en/campaigns/{id}` → 看任一 KOL short 是英文
3. 切到 `/zh/campaigns/{id}` → 同 KOL short 应是中文（**不是英文残留**）
4. 切到 `/ja/campaigns/{id}` → 日文
5. 切到 `/ko/campaigns/{id}` → 韩文
6. 切到 `/es/campaigns/{id}` → 西班牙文
7. 全程同一 campaign 同一 KOL，不应触发额外 LLM 调用（audit_log count 不变）

**Acceptance criteria：**

| Locale | short 显对应语言？ | 句法通顺无机翻感？ | i18n keys (queryButtonLabel / dialogTitle / segments.*.title) 已翻译？ | 备注 |
|---|---|---|---|---|
| en | ☐ | ☐ | ☐ | baseline |
| zh | ☐ | ☐ | ☐ | |
| ja | ☐ | ☐ | ☐ | |
| ko | ☐ | ☐ | ☐ | |
| es | ☐ | ☐ | ☐ | |

**失败处置：**
- 切 locale 后 short 仍英文 → cache key 三元组未生效，看 `readShortExplanation` 是否传 locale 参数
- ja/ko/es 翻译质量低 → BL-014 backlog 同流程（人工 review）；BL-067 不阻塞 done，但记录 5 个最差 case 入 signoff
- i18n keys 漏译（显 raw key 如 `campaigns.detail.explainability.dialogTitle`）→ messages/{locale}.json 同 key cover 漏 → fix-round

---

## §4 Cost cap 满 silent fallback 模拟

**目的：** 验证 audit §1:A `checkLlmCostBudget` boolean API + audit §7 silent fallback to C2 不变量。

**执行步骤：**
1. SSH staging postgres → 跑 SQL 注入 500 行 mock event_log 把当日 cost 推满 $5：
   ```sql
   INSERT INTO event_log (tenant_id, event_type, payload, created_at)
   SELECT '<staging tenant uuid>', 'ai_recommendation.explain_short_generated', '{"costUsd": 0.01}'::jsonb, NOW()
   FROM generate_series(1, 500);
   ```
2. 用 marketer 账号进入一个**未 pre-warm** 的 campaign（新建 1 个或选 staging cold campaign）
3. 观察 AiRecommendationPanel mount → top 30 全显 C2 fallback（不应有 LLM short）+ **不显** toast
4. 点 `?` icon 打开 dialog → 应显 `capExhaustedToast` "AI 详细解释今日额度已满" + dialog 内 fallback 文案
5. 关闭 dialog，进入其他 campaign 仍应 silent fallback（cap 是全 tenant，不分 campaign）
6. SSH 删除 mock event_log 行恢复 cap

**Acceptance criteria：**

| 路径 | 行为 |
|---|---|
| pre-warm path cap 满 | ☐ 无 LLM 调用 / ☐ 显 C2 fallback / ☐ 不发 toast / ☐ audit_log 不记 cap_exhausted（pre-warm 不记 warning per BL-034 风格） |
| dialog path cap 满 | ☐ LLM 不调 / ☐ 显 fallback 文案 / ☐ **显 capExhaustedToast** / ☐ audit_log 记 `ai_recommendation.explain_detailed_cap_exhausted` |

**失败处置：**
- pre-warm 路径发 toast → 违反 §5 不变量 #4，fix-round
- dialog 路径不发 toast → 违反 §5 不变量 #5，fix-round
- cap 满后仍调 LLM → `checkLlmCostBudget` 包装函数错（audit §1:A 实现）→ grep `src/lib/ai/cost-cap.ts:133` 验

---

## §5 Performance spot check

**执行步骤：**
1. Chrome DevTools Network tab open
2. 进入冷 campaign（未 pre-warm）→ 记录：
   - `/api/kols/smart-match` 响应时间
   - `enqueueExplanationPrewarmAction` server action 响应时间（**应 <100ms — fire-and-forget delay:1**）
3. 等 ~30s 后 reload → 记录：
   - `readShortExplanationsBatchAction` 响应时间（30 KOL batch read，应 <500ms）
4. 点 `?` icon → 记录：
   - `requestDetailedExplanationAction` 响应时间（cache miss 走 LLM ≤5s timeout / cache hit <200ms）

**Acceptance criteria：**

| 指标 | 期望 | 实测 | 备注 |
|---|---|---|---|
| smart-match 响应 | <2s（roadmap §11 Phase 3 gate） | ☐ | |
| enqueueExplanationPrewarm 响应 | **<100ms** (fire-and-forget) | ☐ | 验 audit §4:B delay:1 不阻塞 mount |
| readShortExplanationsBatch (30 KOL) | <500ms | ☐ | F003 batch read |
| pre-warm 30 KOL 完成时间 | <60s | ☐ | audit_log 30 行 `explain_short_generated` 时间跨度 |
| Dialog detailed 首次 LLM call | <5s (P99 per roadmap §11) | ☐ | F004 acceptance "5s timeout fallback" |
| Dialog detailed cache hit | <200ms | ☐ | |

**失败处置：**
- `enqueueExplanationPrewarm` >500ms → fire-and-forget 实现有问题（疑 server action 同步等 jobQueue.add）；fix-round 检查 prewarm-actions.ts `void jobQueue.add(...)`
- pre-warm >60s → InMemoryJobQueue 单进程 inline 模式串行 30 KOL × LLM 时间过长；**dogfood marker**：如频繁则 BL-067 done 评估升级 BullMQ concurrency（audit §4:B fallback 路径）

---

## §6 错误注入 spot check（chaos test）

**执行步骤：**
1. SSH staging → 临时改 `.env.staging` 中 `AIGCGATEWAY_API_KEY=invalid_key_test` → `pm2 reload kolmatrix-staging --update-env`
2. 进入冷 campaign → 应：
   - top 30 全 C2 fallback（pre-warm silent skip）
   - 点 `?` icon → 5s timeout 文案 + 不破坏 UI
   - audit_log 应记 `ai_recommendation.explain_*` 失败 event（payload 含 error msg）
3. SSH 恢复正确 API key → `pm2 reload`
4. 进入同 campaign → 验自动恢复（自然 retry on next mount）

**Acceptance criteria：**

| 注入类型 | 期望行为 |
|---|---|
| API key 错误 (401) | ☐ pre-warm silent skip / ☐ dialog timeout 文案 / ☐ UI 不破 |
| API 5xx mock | ☐ silent fallback to C2 / ☐ 不 retry JSON 解析失败 (§5 不变量 #9) |
| 网络断开 (offline) | ☐ silent fallback / ☐ 恢复网络后 reload 自动重 enqueue |

---

## §7 BL-066 回归 spot check（不破坏现有功能）

**执行步骤：**
依次跑 BL-066 `tests/e2e/campaign-match-flow.spec.ts` 6 case staging 实测：
1. 三段 layout（顶 Brief / 中 AI 主面板 / 底 AcceptedKolsPanel）渲染
2. AI 主面板 mount + top 30 渲染
3. 接受 KOL → AcceptedKolsPanel 显新行
4. 跳过 KOL → client-state 切（BL-066 §决策点 #E 保持）
5. 换一批 → 下一组 5 个候选
6. Stale productId → 空态 "Reconnect product"

**Acceptance criteria：**

| BL-066 功能 | 不破坏？ |
|---|---|
| 三段 layout | ☐ |
| AI 主面板 top 30 | ☐ |
| 接受 → kol_campaign 写 + audit_log | ☐ |
| 跳过 client-state | ☐ |
| 换一批 | ☐ |
| AcceptedKolsPanel 6 列 read-only + source chip AI/CSV/Legacy | ☐ |

---

## §8 24h cost monitor + audit script

**执行步骤：**
1. 标记开始时间 T0
2. 24h 后跑 `npx tsx scripts/bl067-cost-audit.ts --env staging` 拉 audit_log type='ai_recommendation.explain_*' 累计
3. 输出 24h 实际 cost / token / call 数 → 与团队 dogfood 实际 spot check 次数对比

**Acceptance criteria：**

| 指标 | 期望 | 实测 |
|---|---|---|
| 24h 总 LLM call 数 | ≤ 团队 dogfood spot check campaign 数 × 30 + dialog click 数 × 1.5 倍 | ☐ |
| 24h flat meter cost | ≤ $0.50（团队 dogfood 量） | ☐ |
| 24h 真实 token spend 估算（haiku-4.5） | ≤ $0.20 | ☐ |
| aigcgateway dashboard 余额变化 | < $5（cap = ceiling） | ☐ |

**异常处置：**
- 24h cost > $5 cap → audit log token spend 反查具体 campaign / KOL，疑 prompt 设计 token leak（prompt 太长或 5 locale JSON 输出超 token）
- 24h 真实 token spend > 估算 2x → 升级 prompt 字数约束（每 locale ≤60 字 vs ≤80 字）

---

## §9 Signoff 触发条件

**全部 §1-§8 spot check 通过 + 24h cost 在 cap 内 + 团队 dogfood 主观体验"AI 解释比 BL-066 占位有帮助" → 触发 signoff：**

1. Reviewer 写 `docs/test-reports/BL-067-signoff-2026-05-XX.md`（参考 `docs/test-reports/BL-066-signoff-2026-05-15.md` 模板）
2. progress.json `status: verifying → done`
3. features.json F007 status `generator_done → done` + 加 `signoff_at` field

**触发 fix-round 的条件：**

任意 §1-§7 spot check 失败 + 失败属 BL-067 引入回归（非 BL-066 sediment）→ status `verifying → fixing` + Generator 回炉修复 + 复跑相关 spot check + status `fixing → reverifying` → 再走 Reviewer 复验。

---

## References

- `docs/specs/BL-067-explainability-c3-spec.md` §F007 acceptance（spot check 触发条件源）
- `docs/specs/BL-067-F001-preimpl-audit.md` §9 Planner 裁决 #1-#6（功能正确性验证依据）
- `progress.json.session_notes.johnsong_generator` Generator 段交付清单
- `docs/test-reports/BL-066-signoff-2026-05-15.md`（signoff doc 模板参考）
- `docs/product/ai-native-roadmap.md §11 Phase 3 verifying gate`（性能 / 覆盖率门槛）

---

## §10 Planner 裁决补充（2026-05-16 BJT / johnsong）

Reviewer 经 round 1 复验（`BL-067-reverify-round1-2026-05-16.md`）+ controlled verification（`BL-067-controlled-verification-2026-05-16.md`）后，3 项 acceptance 边界用户 5/16 ack 降级（per BL-066 F007 §7 量化验证语义优于字面 模式）：

### §1 降级：5 game category → "≥3 cat 实测 PASS"

**裁决理由：** staging seed 当前仅 3 active campaign / 3 game category（PUBG Mobile / Genshin Impact / Honor of Kings）。这是 **staging seed 数据 gap，非 BL-067 功能 gap**。3 个不同 category 已 sufficient 验证多 category 短解释生成质量与 cache key 隔离正确性。补 staging seed 数据是跨批次维护工作（入 backlog），不阻塞 BL-067 signoff。

**修订 §1 acceptance：** "≥3 个不同游戏品类 campaign 实测 short 渲染" 替代原 "≥5"。Reviewer signoff doc 中标注此降级 + 数据 gap 入 backlog（BL-070 二次清理或独立 staging-seed-maintenance batch 处理）。

### §5 perf 量化降级：接受 functional PASS

**裁决理由：** core paths T1-T5 + cap simulation + chaos test 全部 PASS 已充分验证功能正确性。perf gate（smart-match<2s / enqueue<100ms / pre-warm<60s / dialog<5s）在功能 PASS 前提下属 dogfood 期自然观察项 — 如 dogfood 用户报 "mount 30s+ 仍无 short"才是 real issue 需 fix-round。

**修订 §5 acceptance：** 不强制 Chrome DevTools 量测；Reviewer signoff doc 中标注"functional PASS, perf 量化留 dogfood 期 ad-hoc 观察"。BL-066 同模式。

### §8 24h soak 加速：脚本验证 + cap 实测即 sufficient

**裁决理由：** 沿用 BL-065 / BL-066 Reviewer 自评加速模式。`scripts/bl067-cost-audit.ts --hours=24` 脚本已实测可执行（calls=0/tokens=0/cost=0），聚合口径正确；§4 cap simulation 已 PASS 证明 cap 满路径行为；当前 cost=0 表明无生产 LLM 调用泄漏。真 24h soak 数据留 BL-067 done 后 dogfood 期自然累积，每次 dogfood 都通过 cost-audit script 抽查即可。

**修订 §8 acceptance：** 脚本可执行 + cap PASS + 当前 cost=0 即 sufficient；省略真 24h soak。Reviewer signoff doc 中标注此加速。

---

## §11 Reviewer signoff 起步指引

按上述 §10 裁决，Reviewer 可立即起草 `docs/test-reports/BL-067-signoff-2026-05-16.md`（模板参考 `BL-066-signoff-2026-05-15.md`），内容应含：

1. **§1-§9 验收结果汇总**（按本 doc §10 修订后的 acceptance）
2. **fix-round 1 总结**（引 `BL-067-fixround1-2026-05-15.md` + 3 commits f284d35/6dbe231/aa79ce0 root cause/fix/verification）
3. **Reverify round 1 + controlled verification 引用**
4. **caveats 列表：** §1 staging seed 数据 gap（入 backlog）/ §5 perf 量化留 dogfood / §8 真 24h soak 留 dogfood
5. **Harness 结论：** status reverifying → done
6. **prod redeploy 触发条件：** 用户 ack 时间窗 + scripts/deploy-prod.sh 已自动应用 fix-round 1 的 --webpack flag + Turbopack artifact cleanup

Reviewer 起 signoff doc + commit 切 `status: reverifying → done` 后 BL-067 整个批次完成，Planner 接 done 阶段收尾（proposed-learnings 整理 / 询问下一批次 BL-068）。
