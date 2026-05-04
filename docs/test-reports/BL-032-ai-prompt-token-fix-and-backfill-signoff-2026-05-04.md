# BL-032 KB AI prompt placeholder 标准化 + 历史数据 backfill Signoff 2026-05-04

> 状态：**Reviewer first-round PASS**（progress.json status=verifying → done）
> 触发：BL-031 done + prod redeploy 后用户测发邮件，正文出现字面 `[Creator Name]` `[Your Name]` 未替换。

---

## 变更背景

prod 用户 send test 收件正文出现字面方括号 placeholder。Phase 1 调研：`variable-substitute.ts:25` 替换 regex 仅认 Mustache `{{token}}`；KB AI 提示词（`generateAiAssets.ts:88-97`）未指定 placeholder 规约 → AI 自由发挥写 `[Creator Name]`/`[Your Name]` 等方括号。Prod DB 实测：15/16 ai_generated emails 走方括号（5 种变体），1/16 走 mustache（Wizard 路径）。

3 features：F001 改 prompt 强制 Mustache token + 单测；F002 写 backfill 脚本走 `updateAsset` mutation（避免重蹈 BL-030 SQL ops 漏副作用）+ 单测；F003 部署 handoff。

---

## 变更功能清单

### F001：generateAiAssets prompt 加 Mustache token 规约

**Executor：** generator
**文件：** `src/lib/products/generateAiAssets.ts`（修改 line 153-160）/ `src/lib/products/__tests__/generateAiAssets.test.ts`（加 1 case）
**改动：** userMessage 末尾追加 spec §D1 段落字面（'Use these EXACT Mustache tokens' + 5 token + 'do not use square brackets like [Creator Name] or [Your Name]' + Example），用 BL-032-F001 §D1 注释明示。
**验收：** ✅
- 字面逐行匹配 spec §D1（含 'Use these EXACT Mustache tokens' 关键短语 + 5 token + 'do not use square brackets' + Example）
- 既有 prompt 部分不动（line 143-152 product fields/JSON schema 部分照旧）
- 测试 +1 case (line 258-307)：mock fetch 返 mustache 字面 → 断言 prompt 含 5 个 token 字面 + AI mustache 字面 pass-through 到 createAsset.content
- 既有 11 case 不破坏（11/11 PASS）
- L2 staging 实测：创建新 product 触发 generation，**5/5 新 ai_generated assets 全用 mustache，0 bracket 残留**（详见 §L2 端到端实录）

### F002：convert-bracket-tokens-to-mustache.ts backfill 脚本

**Executor：** generator
**文件：** `scripts/convert-bracket-tokens-to-mustache.ts`（新增）/ `scripts/__tests__/convert-bracket-tokens-to-mustache.test.ts`（新增 7 case）
**改动：**
- 算法 spec §D3：`prisma.tenant.findMany` 直读 + 循环 `withTenant` per-tenant 扫 + ILIKE 4 白名单 SQL 预过滤 + 应用层 `hasAnyBracket` 二次防御 + 走 `updateAsset(tx, id, {content})` 触发 `dualWriteEmailTemplateOnUpdate`（不绕 mutation = 不重蹈 BL-030 SQL ops 覆辙）
- 映射 spec §D2 5→2：`[Creator Name]`/`[KOL Name]`/`[Creator]` → `{{kol.name}}`；`[Your Name]` → `{{marketer.name}}`；`[DATE]` 保留
- 默认 dry-run / `--execute` 实跑；幂等靠 content 自查（无 bracket 自动跳过）
- README header 含用法 + rollback（pg_dump 或反向 SQL UPDATE）
- /g regex 状态重置（hasAnyBracket 内 `re.lastIndex = 0` 防御）
**验收：** ✅
- 7/7 测试 PASS（4 acceptance 整合 case：dry-run / 5 bracket → 2 mustache execute / SQL 0 candidates 幂等 / [DATE] 保留 + mirror sync；3 helper case：applyMapping 纯函数）
- mock 模拟 dualWriteEmailTemplateOnUpdate 合约（mirrorUpdates 数组在 updateAsset mock 内追加），断言 mirror 同步带新 subject/body
- L2 staging dry-run 实测：mustache 内容 0 candidates ✓（验证算法对 mustache 内容是 no-op）
- 待 prod 部署后用户 SSH 跑 dry-run + --execute（spec §5 step 3-4）

### F003：部署 + 验收 handoff 文档

**Executor：** generator
**文件：** progress.json `generator_handoff` 字段
**改动：** 完整执行报告 + Reviewer L1+L2 必跑清单 + spec §5 prod 部署顺序复述
**验收：** ✅ handoff 详细，Reviewer 据此一次性进入完整 L1+L2 验收

---

## 未变更范围

| 事项 | 说明 |
|---|---|
| `{{date}}` token 加入 SubstituteVariables | spec §D4 out-of-scope；需扩 SubstituteVariables interface + UI 传 ISO + 时区考虑；留 Soft-watch S1 |
| 视频脚本 `[...]` 检查 | spec §D4 out-of-scope；video_script 不走 substitute pipeline |
| 历史 email_log 已发出的 bad-content 邮件数据 | 已发出无法收回 |
| Prompt 多语种支持 | spec §D4 out-of-scope；KB hardcode 英文输出 |
| AI 输出 server-side validation | spec §4 风险点；列入 v0.9.9 候选（拒收 bracket-only token 的 AI response） |

---

## 预期影响

| 项目 | 改动前 | 改动后（部署 + backfill 后） |
|---|---|---|
| prod ai_generated email placeholder 形态 | 15/16 方括号字面，1/16 mustache | 16/16 mustache（backfill 转 15 + 新生成走 prompt 规约） |
| Send Test 收件正文 KOL 名 | 字面 `[Creator Name]` | KOL 实名（`{{kol.name}}` 替换为 'Aisha' 等） |
| Send Test 收件正文 marketer 签名 | 字面 `[Your Name]` | marketer 实名 |
| email_template mirror（dualWrite 同步）| Asset 改但 mirror 漏（如 BL-030 SQL ops）| 经 updateAsset → dualWriteOnUpdate 自动同步 subject/body |
| L2 staging 新 product 触发 generation | 偶尔含 bracket 字面 | **5/5 全 mustache（0 bracket 残留）** ✓ |

---

## 类型检查 / CI

```
$ npm run lint
✖ 1 problem (0 errors, 1 warning)  # warning 在 youtube.ts，pre-existing 与 BL-032 无关

$ npx tsc --noEmit
(0 errors)

$ npm test
Test Files  118 passed (118)
Tests       810 passed (810)

$ gh run list --branch main --limit 3
completed  success  cc1658d  feat(BL-032-F002): backfill 脚本 + 单元测试      run 25307485574  9m22s
completed  success  e265d6b  feat(BL-032-F001): generateAiAssets 提示词       run 25307065018  9m22s
completed  success  Deploy to Production (BL-031)                              run 25299084297  4m1s
```

BL-032 涉及 2 个测试文件单跑：generateAiAssets.test.ts (11/11) + convert-bracket-tokens-to-mustache.test.ts (7/7) = 18/18 ✓

---

## L2 Staging 端到端验收实录（2026-05-04 ~09:25 UTC）

| 验证项 | 方法 | 结果 |
|---|---|---|
| Staging git_sha | curl /api/health | cc1658d ✓ DB latency 326ms |
| F001 prompt 修生效 | 创建 test product → generateAiAssets 真实 aigcgateway 调用 → 查新 ai_generated assets | **5/5 全 mustache，0 bracket 残留** ✓ |
| F001 dualWrite 镜像 | 查 email_template 表 | 3 行 mirror（每个 email asset 一个，video 不写）✓ |
| F001 audit 写入 | 查 audit_log 表 | 5 行 `asset.generated`（每个 asset 一个）✓ |
| F001 Product.aiAssets 状态 | 查 product 表 | `ready` ✓ shrunk 正确 |
| F002 dry-run 对 mustache 内容 | 立即跑 backfill dry-run | 0 candidates ✓（SQL ILIKE 4 白名单不匹配 mustache）|
| Cleanup 完整性 | 跑 --cleanup → 验 baseline | 5 product / 0 ai_generated / 11 email asset / 12 email_template / 0 audit ✓ |

**Reviewer L2 真实 aigcgateway 调用样本（部分）：**

```
email "Initial outreach": "Let's Partner on {{product.name}} – Fast-Paced {{product.category}} for Your Audience"
  mustache=8 ({{kol.name}}, {{product.name}}, {{product.category}}, {{product.usp}}, {{marketer.name}})
  bracket residue=0

email "Follow-up": "{{kol.name}} – {{product.name}} Early Access Ready (24-Hour Window)"
  mustache=8

email "Signing invitation": "Official {{product.name}} KOL Partnership – Sign Here"
  mustache=6

video_script "TikTok 15s": mustache=4
video_script "YouTube 60s": mustache=7
```

**模型表现：** 一次 12.8s 的真实 claude-haiku-4.5 调用，5/5 全部遵守新 prompt 规约 — 0 方括号残留。spec §4 中 medium-prob 风险（"AI 偶尔不遵循 prompt 指令"）本次未触发，但仍建议 v0.9.9 加 server-side validation。

**操作记录：**
- 临时 tsx 脚本 `/opt/kolmatrix-staging/scripts/_bl032_reviewer_l2.ts`（自带 setup + verify + cleanup mode）已 scp 上传 → 跑 → 删
- staging 副作用：1 product + 5 assets + 3 email_template mirrors + 5 audit_log 行（全部 cleanup 删除，dataset 回归 baseline）
- 真实 aigcgateway cost：~$0.001 一次调用（在 $100 月预算内）
- 收件邮箱：N/A（本次 L2 不涉及 Send Test，spec §5 step 5 由用户 prod 部署 + backfill 后跑）

---

## Harness 说明

本批改动经 Harness 状态机完整流程（planning → building → verifying → done）交付。
本批次中 Generator 启动时识别 ./generator.md vs role-context/generator.md 角色测试边界冲突（line 11 单行硬规 vs role-context 软规），用户裁决 C 方案 — Planner 矩阵化（commit 1bef058）。BL-032 features.json 不动（已符合矩阵）。
`progress.json` 已设为 `status: "done"`，signoff 路径已填入 `docs.signoff`。
fixing/reverifying 阶段未触发（first-round PASS）。

---

## Soft-watch（不阻塞 done，需后续跟进）

| ID | 描述 | 风险等级 | 建议处置 |
|---|---|---|---|
| S1 | `[DATE]` token 留字面（spec §D2/§D4）— prod 现 15 行 ai_generated email 中部分含 `[DATE]`，backfill 不动；用户测 send 时 `[DATE]` 会原文发出。如未来需替换，要扩 `SubstituteVariables` interface + 决定时区源（UTC vs tenant locale）+ UI 调用点统一注入 `new Date().toISOString()` | low | 入 backlog 单独迷你批次（可与 BL-031 Soft-watch S2 dualWrite/send id 翻译漏洞合并整治） |
| S2 | AI 偶尔不遵循 prompt 规约（claude-haiku-4.5 generation 不确定性）— 本次 L2 单次调用 5/5 全合规 0 bracket，但 spec §4 风险表标 medium-prob。生产规模触发后会再生 bracket-style asset，需 backfill 脚本兜底 | medium | v0.9.9 候选：generation 完成后加 server-side validation（拒 contains-bracket 的 AI response，重试或 fallback）。Generator handoff 已主动入 v0.9.9 候选清单第 6 项 |
| S3 | dualWriteEmailTemplateOnUpdate 用 updateMany 静默 count=0（mutations.ts:148 注释）— 当 email_template 表镜像缺失（如 staging BL-031 1 行 orphan asset 同源情况）时，updateMany 报 count=0 但脚本 stats 仍 +1 mirrorsAttempted。Reviewer 无法仅从脚本输出区分"成功镜像"vs"silent miss"。当前 staging dry-run 0 candidates 此问题未触发，但 prod 跑 --execute 时若 15 行中有 mirror 缺失，无法察觉 | low | mutations.ts:148 已知边界；脚本输出已注明（line 203）。建议 BL-032 prod backfill 跑完后 SQL probe 抽查 email_template 表 subject/body 与 asset.content 是否实际同步 |

---

## Framework Learnings

### 新规律 / 新坑

- **生成式 AI 输出必须在 prompt 显式约束 placeholder 语法 + server-side validation 兜底**（已在 v0.9.9 候选清单第 6 项；本次 L2 单次 5/5 合规验证了 prompt 修法的有效性，但不能替代 validation 兜底）
  - 来源：BL-032 触发故障 + L2 实测
  - 建议写入：`framework/harness/generator.md` §AI 集成检查清单 / `framework/README.md` §经验教训

- **dualWrite updateMany 静默 count=0 是 silent failure 模式**（Soft-watch S3 来源）— 任何走 updateMany 兜底"missing mirror 不报错"路径的脚本，事后必须能 SQL probe 抽查实际同步状态，光看脚本 stats 不够
  - 来源：BL-032 verifying 期检视 mutations.ts:148
  - 建议写入：`framework/harness/database-patterns.md`（与 §3 InputJsonValue 同节扩展 dual-write/silent-failure 子章节）

### 模板修订

- 沿用 BL-031 提案：`framework/templates/signoff-report.md` 加 §"L2 端到端验收实录" + §"Reviewer ops 操作记录与副作用" 标准小节。本次 signoff 同样手工补这两节，建议 v0.9.9 入框架（重复信号 = 真需求）
  - 来源：BL-031 + BL-032 connect signoff 两次手工补充
  - 建议修改：`framework/templates/signoff-report.md` 加节
