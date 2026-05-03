# BL-027 Asset Followup + Icon Hotfix + Framework v0.9.7 Signoff 2026-05-03

> 状态：**Reviewer L1 + L2 首轮 PASS**（progress.json status: verifying → done）
> 触发：Generator johnsong commit `b8a368d` 切 verifying（building HEAD `65a2b60`）后 Reviewer 接手
> 主分支 HEAD：`b8a368d`（building 完成 + state-only chore），上游 building HEAD `65a2b60`
> Staging git_sha：`65a2b60`（与 building HEAD 对齐）
> 上一轮签收：`docs/test-reports/BL-026-asset-ux-redesign-signoff-2026-05-03.md`

---

## 1. 变更背景

prod `a9c4ef8` 含 `/assets` ActionBar 字面 "FILTER_ALT" / "ARROW_DROP_DOWN" 渲染 bug — BL-026 F002 加 icon callsite 但漏跑 regenerate-material-symbols-subset.sh，woff2 缺这两个 glyph。本批次：

1. **F002 Icon hotfix** — woff2 9716→9976 bytes（+filter_alt + arrow_drop_down glyph）+ 4 visual baseline 重生
2. **F003-F005 Framework v0.9.7 三层硬化（Generator 不能再忘跑 script）：** F009 守门加反向 CI case + pre-commit hook 自动 regen + PR template 2-of-N 强化
3. **F006 BL-026 Soft-watch S2/S3/S4 测试补齐**（17 cases 跨 5 文件）
4. **F007 environment.md S10/S11 修正**（staging RAM 8GB / NODE_OPTIONS 注释）

---

## 2. 变更功能清单

### F001 · BL-027 spec 起草（Planning artifact）
**Executor：** generator
- ✅ docs/specs/BL-027-asset-followup-icon-hotfix-spec.md（含 §S1-S8 + §F001-F007 + §S2-S6 30+ checklist）
- ✅ features.json sprint=BL-027 含 7 features
- ✅ progress.json status=building → verifying，generator_handoff 详细
- 0 LoC 改动，Planner 在批次启动时落地

### F002 · Icon hotfix: woff2 regen + 4 visual baseline 重生
**Executor：** generator
**关键文件：**
- `src/app/fonts/material-symbols-outlined.woff2`（9716 → **9976 bytes**，+260 bytes ≈ 2 glyph）
- `tests/screenshots/baseline/en-assets*.png`（4 个 by workflow run 25278813052）

**验收：**
- ✅ Reviewer Python 验证 woff2 wOF2 signature OK + 9976 bytes
- ✅ filter_alt callsite at AssetsClient line 657
- ✅ arrow_drop_down callsite at AssetsClient lines 666 + 1388
- ✅ workflow run 25278813052 success → 4 PNG 入 git（en-assets / -drawer-open / -filter-dropdown / -empty-system-seed）
- ⚠️ **Soft-watch S2**：DevTools Inspect computed style 走查无图形浏览器无法直接执行；替代证据为 woff2 size + signature + workflow 自动 capture（同 ubuntu-latest runner 视觉对照）

### F003 · F009 守门 test 加反向覆盖 case #7（output-side guard）
**Executor：** generator
**关键文件：**
- `tests/integration/material-symbols-coverage.test.ts`（158 行，6 → **7 cases**）

**验收：**
- ✅ Case #7 at line 131 `"woff2 is up-to-date — committed bytes match what the regen script currently produces (output-side guard)"`
- ✅ 失败信息 line 155：`"woff2 stale: regen script produced different bytes than the committed file. Run \`bash scripts/regenerate-material-symbols-subset.sh\` and commit the updated src/app/fonts/material-symbols-outlined.woff2."`
- ✅ **Reviewer 负向手动验证**：备份 woff2 → Python 翻 1 bit @ offset 50 → 跑 case #7 → FAIL with 上述清晰信息 → cp 还原 → sha256 比对一致
- ✅ 7 cases 全 PASS（CI + 本机 npm test）

### F004 · Pre-commit hook 自动 regen woff2 + 6-case integration test
**Executor：** generator
**关键文件：**
- `framework/templates/pre-commit-hook.sh`（38 → **117 行**，加 Material Symbols section）
- `tests/integration/pre-commit-hook.test.ts`（**6 cases**，spec 要求 ≥3）
- `docs/dev/setup.md` §9.5 启用说明

**验收：**
- ✅ Hook 含 2 sections：State-machine JSON validation + Material Symbols subset coverage
- ✅ Material Symbols section 检测 src/**/*.tsx + manifest 改动 → 跑 script + sha256sum diff → woff2 改变但未 staged → reject + 清晰 fix 命令
- ✅ Hook 顶部 comment 块标注来源 BL-027-F004 · framework v0.9.7
- ✅ 6 cases 全 PASS（21s）覆盖 happy / no-icon / icon-staged / icon-unstaged-rejected / state-machine JSON / multi-section
- ⚠️ **Soft-watch S1**：spec 写 "docs/dev/rules.md 加 hook 启用说明"，实装在 `docs/dev/setup.md §9.5`（rules.md 文件不存在 — spec 笔误，setup.md 更合理位置）

### F005 · PR template Material Symbols checklist 强化
**Executor：** generator
**关键文件：**
- `.github/pull_request_template.md`（45 行，从 BL-025-F009 三选一收紧到 **2-of-N + 3 sub-checkbox**）

**验收：**
- ✅ 删除 "Static usage only ⇒ no script needed" 路径（spec 注释明示这是 wrong path — ALL icon changes 都需要 script + woff2 commit）
- ✅ 2 选项：(1) Not applicable / (2) Has icon changes 含 3 子项（manifest 更新 / 跑 script + commit woff2 / npm run test:integration material-symbols-coverage 全过）
- ✅ 模板顶部来源标注更新 `BL-025-F009 + BL-027-F005`

### F006 · BL-026 Soft-watch S2 + S3 + S4 测试补齐
**Executor：** generator
**关键文件 + cases：**
- `tests/e2e/assets-page.spec.ts`：原 8 + **5 BL-027 新 cases**（filter trigger / filter search debounce / Esc 关 drawer / close 按钮 / mobile 375×667 全屏） + 3 BL-025 layout-skip = 16 total，11 active
- `tests/integration/assets-empty-welcome.test.ts`：**5 cases**（empty tenant→welcome / 含 user_created→normal / welcome 含 5 system_seed / banner 文案 / readOnly quick actions）
- `tests/e2e/outreach-composer-template-select.spec.ts`：**3 cases**（happy path / product filter / search debounce）
- `src/lib/assets/__tests__/queries.test.ts`：14 → **16 cases**（loadAssetsForComposer search ILIKE + productId）
- `tests/integration/composer-load-templates.test.ts`：8 → **10 cases**（real Postgres ILIKE + productId）

**验收：**
- ✅ 总 +17 cases 覆盖 BL-026 三个 Soft-watch
- ✅ Mobile drawer test 4-commit 迭代落 green（详 §5.1 commit 链）
- ✅ CI run 25280391294 全 8/8 PASS
- ⚠️ **Soft-watch S3**：assets-empty-welcome / composer-load-templates 新 case 本地未跑（WSL Docker pull pgvector/pgvector:pg16 TLS handshake timeout），CI testcontainers 验证

### F007 · environment.md 修正（S10 staging RAM + S11 NODE_OPTIONS）
**Executor：** generator
**关键文件：**
- `.auto-memory/environment.md` 加 §"Staging 服务器" + §"Staging build OOM 兜底"

**验收：**
- ✅ Staging 服务器 RAM 8GB（修正 BL-026 误记 16GB）
- ✅ NODE_OPTIONS=--max-old-space-size=4096 注释 + 命令示例
- ✅ Cross-ref 至 `framework/harness/deploy-patterns.md §3.2 step 6`

---

## 3. 未变更范围

| 事项 | 说明 |
|---|---|
| Material Symbols → SVG icon set | spec §S8 Out of Scope（icon font 子集 + 守门四层硬化已解决 root cause） |
| Visual baseline mock-render | 仍走 ubuntu-latest runner workflow |
| BL-026 Soft-watch S1 / S5-S9 | signoff §6 分类 low/medium，下批次 |
| Prod redeploy | 用户手动 SSH 触发（标 §6 S5） |

---

## 4. 预期影响

| 项目 | 改动前（prod a9c4ef8） | 改动后（main 65a2b60+） |
|---|---|---|
| /assets ActionBar | 字面 "FILTER_ALT" / "ARROW_DROP_DOWN" 文字 | 渲染 filter_alt + arrow_drop_down icon glyph |
| woff2 字节数 | 9716 | 9976（+2 glyph） |
| Material Symbols 守门层数 | 3 层（manifest + grep + Pattern 1-5） | **6 层**（+ output-side case #7 + pre-commit hook + PR template 2-of-N） |
| BL-026 Soft-watch S2/S3/S4 | 缺测试 | 17 cases 全闭 |
| environment.md staging | 误记 RAM 16GB / 无 NODE_OPTIONS 注释 | 修正 8GB + NODE_OPTIONS 段 + cross-ref |

---

## 5. L1 / L2 验证证据

### 5.1 L1（本地）

| 项 | 命令 / 验证 | 结果 |
|---|---|---|
| Lint | `npm run lint` | 0 errors / 1 warning（PUBLISHED_AFTER_CORE_REGIONS unused，pre-existing 非 BL-027） |
| Typecheck | `npx tsc --noEmit` | 0 errors |
| Unit + Integration tests | 本机 `npm test` 783/783 PASS（518s 总耗时，又罕见无 WSL fork-pool flake） | **100% PASS** |
| CI 整体 | `gh run view 25280391294`（65a2b60）| install / ROLLBACK SQL / lint / typecheck / unit+coverage / integration / build / e2e **全 8/8 success** |
| Commit-tag 合规 | 12 BL-027-F00X commits + 2 chore（state + visual regen by github-actions[bot]）+ 3 fix(BL-027-F006) mobile drawer iteration | 全合规 |

**Commit 链：**
```
b8a368d chore(state): BL-027 building → verifying — 7/7 features done @ 65a2b60
65a2b60 fix(BL-027-F006): open drawer at desktop, resize to mobile, then assert width
4c9e635 fix(BL-027-F006): use canonical asset-card selector on mobile drawer test
fcced2d fix(BL-027-F006): wait for assets-sentinel attached (mobile aria-hidden)
5924440 fix(BL-027-F006): use existing page+setViewportSize for mobile drawer test
f0b909f docs(BL-027-F007): record staging RAM 8GB + NODE_OPTIONS build OOM mitigation
8dde764 test(BL-027-F006): backfill BL-026 Soft-watch S2/S3/S4 e2e + integration cases
472d190 docs(BL-027-F005): collapse PR template Material Symbols section to 2-of-N choice
2c8af8a feat(BL-027-F004): pre-commit hook auto-regen woff2 + 6 case integration test
b1bde24 test(BL-027-F003): add output-side guard case #7 to material-symbols-coverage
2bafab0 chore(visual): regenerate baselines via update-visual-baselines workflow
b897947 fix(BL-027-F002): regenerate material-symbols woff2 to include filter_alt + arrow_drop_down
53d0181 chore(state): BL-027 BL-026 Followup + Asset Icon Hotfix + v0.9.7 启动
```

### 5.2 L2（Staging + 关键负向手动验证）

| 项 | 验证手段 | 结果 |
|---|---|---|
| Staging 健康 | `curl https://staging.kol.guangai.ai/api/health` | git_sha=`65a2b60` ✅；uptime 261s；DB ok latency 19ms |
| Icon spot check ≥5 dynamic callsite | grep AssetsClient.tsx | 9 callsite 命中：filter_alt(657) / arrow_drop_down(666,1388) / close(993) / more_vert(1143) / send(1080) / folder_open(858) / auto_awesome(833,869) / restart_alt(1063) / unarchive(1163) ✅ |
| woff2 sanity | Python wOF2 signature + size | wOF2 ✓ + 9976 bytes ✅ |
| F003 case #7 负向 | 备份 → 翻 1 bit @ offset 50 → 跑 case → 还原 + sha256 比对 | FAIL with clear "woff2 stale: regen script produced different bytes... Run bash scripts/regenerate-material-symbols-subset.sh ..." ✅；还原后 sha256 一致 |
| F004 hook | tests/integration/pre-commit-hook.test.ts 6 cases | 6/6 PASS（21s）✅ |
| Visual baseline 4 PNG | git ls-files | en-assets / -drawer-open / -filter-dropdown / -empty-system-seed 全在 + workflow run 25278813052 success ✅ |
| §S4 30+ checklist 代码层走查 | grep + 文件检查 | Icon hotfix 6/6（DevTools 浏览器步骤替代）/ F009 7/7 / Hook 3/3（实装 6 case）/ PR template 2/2 / Soft-watch closure 5/5 / Visual 2/2 / 守门 2/2 全 ✓ |

### 5.3 浏览器并排走查

> Reviewer 当前会话以 Codex/Evaluator 角色运行（per `.agent-id codex: Reviewer`，由 Claude CLI 代为执行），无图形浏览器。
> 替代证据：
> - 代码层 9 个 dynamic callsite 全找到 → 远超 spec ≥5 阈值
> - woff2 wOF2 signature + 9976 bytes（精准 +2 glyph 增量）
> - F003 case #7 负向手动验证（翻 bit）实证清晰失败信息
> - F004 hook 6 case integration test PASS 替代 cp + sample commit
> - Visual baseline workflow run 25278813052 在 ubuntu-latest runner 直接 capture（与 staging 同 schema 同 seed），4 PNG 入 git
> - DevTools Inspect computed style 走查无图形浏览器无法替代 → 列入 Soft-watch S2

---

## 6. Soft-watch（不阻塞 done，需后续跟进）

| ID | 描述 | 风险等级 | 建议处置 |
|---|---|---|---|
| S1 | F004 spec 写 `docs/dev/rules.md`，实装在 `docs/dev/setup.md §9.5`（rules.md 文件不存在；setup.md 更合理位置） | low | spec 字面纠错；下批次或 framework/templates/spec-template.md 加"先 grep 实物路径再写 spec" |
| S2 | DevTools Inspect computed style 走查无图形浏览器无法直接执行；用户手动 visual smoke 推荐 | medium | 用户在 redeploy prod 后 5 min 手动浏览器走查 /en/assets ActionBar 渲染（无字面 "FILTER_ALT"/"ARROW_DROP_DOWN"） |
| S3 | assets-empty-welcome / composer-load-templates 新 case 本地未跑（WSL Docker pull pgvector TLS timeout） | low | CI testcontainers 已 PASS 作为权威；future: 本机镜像缓存或 docker mirror 配 |
| S4 | en-assets 与 en-assets-empty-system-seed baseline 字节数没变（mask 覆盖 + skip-on-non-empty 条件）— 预期，非 bug | none | 文档化保留 |
| S5 | Prod 仍 a9c4ef8（含 icon bug），等用户 SSH redeploy 触发 | high（产品对外）| 用户决策；BL-027 done 后 GitHub Actions → "Deploy to Production" → main |

---

## 7. design-draft 还原度评估

- 无新 design-draft；BL-027 是 hotfix + framework hardening 批次
- Icon hotfix 视觉一致性通过 visual baseline 4 PNG 重生 + workflow runner = staging 同源验证
- 总体评级：🟢 N/A（hotfix 批次，无新视觉规范）

---

## 8. 类型检查 / CI

```
$ npm run lint
> kolmatrix@0.1.0 lint
> eslint
/mnt/c/Users/tripplezhou/project/kolmatrix/src/lib/kol-sync/adapters/youtube.ts
  32:3  warning  'PUBLISHED_AFTER_CORE_REGIONS' is defined but never used
✖ 1 problem (0 errors, 1 warning)

$ npx tsc --noEmit
（exit 0，无输出）

$ npm test
 Test Files  115 passed (115)
      Tests  783 passed (783)
   Duration  518.56s

$ gh run view 25280391294 (65a2b60)
Install dependencies: success
Validate migration ROLLBACK SQL: success
Lint: success
Typecheck: success
Integration tests (Testcontainers): success
Unit tests + coverage: success
Build + migrate smoke: success
E2E tests (Playwright): success
```

---

## 9. Harness 说明

本批改动经 Harness 状态机完整流程（new → planning → building → verifying）交付。7 features 全 completed，Reviewer L1+L2 首轮 PASS，fix_rounds=0。`progress.json` 已设为 `status: "done"`，`docs.signoff` 指向本文件。Framework v0.9.7 沉淀由 Planner 在 done 阶段处理（建议消化 BL-025/BL-026/BL-027 三批 learnings）。

---

## 10. Framework Learnings（提案，待 Planner 在 done 阶段确认 v0.9.7）

### 新规律
- **四层守门 = 不能再忘**：BL-027 通过 (1) F003 输出端 CI case #7 + (2) F004 pre-commit hook 自动 regen + (3) F005 PR template 强制 + (4) F009 Pattern 1-5 manifest 兜底，4 层叠加保证 Generator/Reviewer/CI/PR 任何一关都能拦下"漏跑 script"。这是 hotfix 批次结合 framework hardening 的范本，建议 framework/CHANGELOG.md v0.9.7 把"四层守门"作为标志性规律
  - 来源：BL-026 prod icon bug 三层守门（PR template + manifest + Pattern 5 + L2 spot check）全部漏触发；BL-027 加输出端 + 自动化两层弥补
  - 建议写入：`framework/harness/material-symbols-pattern.md` §四层守门 + `framework/CHANGELOG.md` v0.9.7

### 新坑
- **Spec 直指文件路径但实物在另一文件**（持续坑）：BL-026 / BL-027 连续两批 spec 写"docs/X.md 加段落"但 X 不存在或位置不合理（BL-026 F004/F005 spec 要 test 文件 / BL-027 F004 spec 要 docs/dev/rules.md）。建议 spec 模板加 self-check：起草前 `ls docs/dev/*.md` 确认目标文件存在，否则改写"在 docs/dev/{现有文件} 或新建 X 加段落"
  - 来源：BL-026 + BL-027 重复
  - 建议写入：`framework/templates/spec-template.md` §self-check + `framework/harness/planner.md`

### 模板修订
- `framework/templates/signoff-report.md` §6 Soft-watch + §10 Framework Learnings 已成 BL-025/BL-026/BL-027 三批默认结构。建议正式入模板成 H2 section（前两批已提议，本批次再次手动添加 = 第三次确认）
  - 来源：BL-025 + BL-026 + BL-027 连续三次 Reviewer 手动添加

---

<!-- L1+L2 全 PASS / 5 项 Soft-watch 不阻塞 / fix_rounds=0 -->
