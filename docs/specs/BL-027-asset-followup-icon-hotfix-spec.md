# BL-027 — BL-026 Followup + Asset Icon Hotfix + Framework v0.9.7

**批次类型：** Generator-only（7 features 全部 executor:generator）
**估时：** ~1.5-1.75 day（Generator ~1.4 + Reviewer ~0.3）
**触发：** 用户 2026-05-03 走查 prod 发现 /assets ActionBar 渲染字面 `FILTER_ALT` / `ARROW_DROP_DOWN`（应为 icon glyph）+ BL-026 12 条 Soft-watch 中 5 条需补
**前置：**
- ✅ BL-026 done（2026-05-03 signoff PASS）+ prod 已 redeploy 至 a9c4ef8（含 bug）
- ✅ 用户决议（2026-05-03 19:50）：Generator 走完整流程 / 最严格 framework 沉淀 / 合并 BL-026-followup
**Definition of Done：** 7 features 全 PASS + Reviewer L1+L2 签收 + woff2 含 `filter_alt`+`arrow_drop_down`（实测 ligature 渲染）+ 4 visual baseline 重生入库（en-assets / -drawer-open / -filter-dropdown / -empty-system-seed）+ 新 F009 反向 case 跑过 + pre-commit hook 跑通 + PR template 强化 + S2/S3/S4/S10/S11 全闭合 + framework v0.9.7 沉淀（Planner 在 done 阶段处理）+ staging+prod redeploy。

---

## 根因分析（用户拍板共识）

### 表象
prod /assets `/en/assets` 路由 ActionBar 顶部 GhostButton "Filter ▾" 旁渲染字面 `FILTER_ALT`；Sort Select 旁渲染 `ARROW_DROP_DOWN`。

### 直接原因
BL-026 F002 在 `src/app/[locale]/(app)/assets/AssetsClient.tsx:657, 666, 1388` 加了 3 个新 icon callsite（`filter_alt` ×1 + `arrow_drop_down` ×2）。Generator 实装时**没跑** `bash scripts/regenerate-material-symbols-subset.sh`，woff2 字符表不含这 2 个 glyph。Material Symbols 字体的 ligature 替换失败 → 浏览器 fallback 显示字面字符。

### Framework 漏洞（最重要的发现）

**漏洞 1 — F009 守门 test 是输入侧验证而非输出侧验证：**
- 6 个 case 全是 manifest 语法 / 5 patterns 还在 / woff2 size > 2KB 等"前置条件"检查
- 不验证 woff2 实际包含 src/ 中全部当前 icon 引用 → CI 全绿但 prod 字面渲染

**漏洞 2 — visual baseline 是 bug 状态下截的：**
- BL-026 verifying Reviewer 跑 update-visual-baselines workflow 重生 `en-assets.png` 等 5 个 baseline
- 浏览器在 prod build 直接渲染了字面文字，**baseline 文件本身保存了"FILTER_ALT/ARROW_DROP_DOWN"作为正确状态**
- CI visual regression 比 baseline 自身 → PASS（基准错误则回归无效）

**漏洞 3 — PR template "Static usage" 路径不要求跑 script：**
- 当前 PR template 把 icon 改动分 "Not applicable" / "Static usage only" / "Dynamic usage"
- "Static usage only" 路径不要求跑 regen script + commit woff2
- BL-026 F002 加的 icon 是 Pattern 2（multi-line `<span>name</span>` 静态形式），按当前模板属于"Static usage"，Generator 勾选后不需要跑 script
- 实际即便是 static usage 也需要跑 script 才能让 woff2 包含新 glyph

**漏洞 4 — v0.9.6 [#6] L2 字体子集 spot check 规则有但执行没到：**
- evaluator.md §13 写"含字体子集的 perf feature 必须 L2 烟测 ≥ 5 dynamic callsite"
- BL-026 verifying 实际只看 visual baseline 文件存在性，没浏览器实测
- 规则纸面有，执行没落地

### 修复方案（4 层兜底，最严格）

| 层 | 修复 | 落 feature |
|---|---|---|
| 立即 hotfix | regen script run + commit woff2 + 4 visual baseline 重生 | F002 |
| CI 守门加固 | F009 test 加反向 case：跑 script，diff woff2，必须无差异 | F003 |
| Pre-commit 兜底 | 扩展 framework/templates/pre-commit-hook.sh：检测 icon callsite 改动时自动跑 script，woff2 不一致拒提交 | F004 |
| 流程加固 | PR template 强化：所有 icon 改动（static + dynamic）都必须跑 script + commit woff2 | F005 |
| 沉淀 | v0.9.7 framework learning：material-symbols-pattern.md + evaluator.md §13 修订 | done 阶段 Planner 处理 |

---

## §S1 UI Fidelity Guardrail（按 v0.9.6 [#5] self-check）

本批次**不是 UI 类 feature**（无新页面、无视觉重构），仅含 hotfix + framework hardening + test backfill。**4 段不适用**，但保留 §S1.6 visual baseline 重生条目，其余 3 段 N/A。

### S1.6 Visual baseline 重生 4 个

`tests/screenshots/baseline/`：
1. `en-assets.png` — ActionBar 含 Filter ▾ 按钮（filter_alt + arrow_drop_down 正确渲染为 icon）
2. `en-assets-drawer-open.png` — ActionBar 同上 + drawer 覆盖右侧
3. `en-assets-filter-dropdown.png` — Filter dropdown 展开时 ActionBar 仍显（trigger arrow 切 up）
4. `en-assets-empty-system-seed.png` — empty welcome 状态 ActionBar 含 filter_alt

**不重生**：`en-outreach.png`（无 ActionBar 受影响）/ `en-assets-wizard-step1.png` + `en-assets-wizard-step3.png`（wizard 内不含相关 icon，BL-025-followup 已入库）。

---

## §F001 — BL-027 spec 起草（Planning artifact）

### Acceptance

- [ ] 本 spec 文件 `docs/specs/BL-027-asset-followup-icon-hotfix-spec.md` 起草完成
- [ ] features.json 含 7 features，F001 status=completed（Planner 已落）
- [ ] progress.json status=building，generator_handoff 含执行顺序 + 关键约束
- [ ] `.auto-memory/project-status.md` 更新（含 BL-027 starting + prod a9c4ef8 含 bug 状态）
- [ ] 不动代码，0 LoC

**估时：~0.25 day**

---

## §F002 — Icon hotfix: woff2 regen + 4 visual baseline 重生

### 实装

#### F002.A 跑 regen script + commit woff2

```bash
bash scripts/regenerate-material-symbols-subset.sh
```

预期：`src/app/fonts/material-symbols-outlined.woff2` 9716 → 9976 bytes（增 260 bytes = 2 新 glyph）。

- [ ] 验证 script stdout 含 `discovered N unique icons`，N 包含 filter_alt + arrow_drop_down（Pattern 2 命中）
- [ ] commit woff2：`git add src/app/fonts/material-symbols-outlined.woff2`
- [ ] commit message: `fix(BL-027-F002): regenerate material-symbols woff2 to include filter_alt + arrow_drop_down`

#### F002.B 触发 update-visual-baselines workflow

```bash
gh workflow run update-visual-baselines.yml --ref main
```

- [ ] workflow 跑通（Playwright 重截 4 baseline）
- [ ] workflow 自动 commit 4 PNG to main（GITHUB_TOKEN push，不触发下游 CI per deploy-patterns.md §4.1）
- [ ] 退化测试：跑 `npm run test:e2e -- visual-regression` 验证 4 baseline 与新 staging 一致
- [ ] 如 update-visual-baselines workflow 跑完后下游 CI 没触发，followup 一个 chore retrigger commit per deploy-patterns.md §4.1（可选）

#### F002.C 浏览器实测验证

- [ ] staging deploy 后用浏览器开 `https://staging.kol.guangai.ai/en/assets` 走查
- [ ] ActionBar Filter 按钮渲染 filter_alt icon glyph（非字面字符）
- [ ] Sort Select 旁渲染 arrow_drop_down icon glyph
- [ ] Filter dropdown 展开时 trigger arrow 切 up 图标
- [ ] 浏览器开发者工具 Inspect 元素，computed font-family 是 "Material Symbols Outlined" + 字面字符在 DevTools 不可见（已被 ligature 替换）

### 估时：~0.1 day

---

## §F003 — F009 守门 test 加反向覆盖 case（output-side guard）

### 实装位置

`tests/integration/material-symbols-coverage.test.ts`

### Acceptance

#### F003.A 加 test case #7

新加测试：`it("woff2 is up-to-date with current src/ icon callsites — script run produces no woff2 diff", ...)`

```typescript
it("woff2 is up-to-date — regen script run produces no diff vs committed woff2", () => {
  const beforeBytes = readFileSync(WOFF2);
  // Run script, capture stdout (already smoke-tested case #6 to be > 50 icons)
  execSync(`bash ${SCRIPT}`, { cwd: REPO_ROOT, encoding: "utf8", timeout: 60_000 });
  const afterBytes = readFileSync(WOFF2);
  expect(
    afterBytes.equals(beforeBytes),
    `woff2 stale: regen script run changed file. Run \`bash scripts/regenerate-material-symbols-subset.sh\` and commit the updated woff2.`
  ).toBe(true);
});
```

**关键设计：**
- 这条 case 用 fs.readFileSync(WOFF2) Buffer.equals 比较二进制
- 失败信息明确指出"跑 script + commit woff2"
- 跟 case #6 不同：case #6 是 smoke test (script 跑通 + > 50 icons)，case #7 是 outcome verify (woff2 ≡ script 当前会生成的内容)

#### F003.B 测试自身验证

- [ ] 本批次 F002 commit woff2 后跑 case #7 → PASS
- [ ] 假设场景测试：手动 mv woff2 woff2.bak → 跑 case #7 → 应 FAIL with 清晰信息（仅本地验证，不 commit 到 git）
- [ ] 跑 `npm run test:integration -- tests/integration/material-symbols-coverage.test.ts` 全 7 case PASS

### 估时：~0.2 day

---

## §F004 — Pre-commit hook 自动 regen woff2 when icons change

### 实装位置

`framework/templates/pre-commit-hook.sh`（扩展现有 38 行模板，加新 section "Material Symbols subset coverage"）

### Acceptance

#### F004.A 扩展 hook 模板

在现有 STATE_FILES 校验之后，加新检测块：

```bash
# Material Symbols subset coverage check
# Source: BL-027-F004 v0.9.7 framework hardening
# 触发：BL-026 F002 加 filter_alt + arrow_drop_down 但 Generator 没跑 regen script
# 防御：检测 icon callsite 改动，自动跑 script，woff2 不一致拒提交

icon_files_staged=false
for staged_file in $(git diff --cached --name-only --diff-filter=ACM); do
  case "$staged_file" in
    src/**/*.tsx|src/**/*.ts|scripts/material-symbols-icons-manifest.txt)
      if grep -qE "material-symbols-outlined|^\s*[a-z_][a-z_0-9]*\s*$" "$staged_file" 2>/dev/null; then
        icon_files_staged=true
        break
      fi
      ;;
  esac
done

if $icon_files_staged; then
  echo "→ pre-commit: detected Material Symbols icon callsite changes — verifying woff2..."
  before_hash=$(sha256sum src/app/fonts/material-symbols-outlined.woff2 | awk '{print $1}')
  bash scripts/regenerate-material-symbols-subset.sh > /dev/null 2>&1 || {
    echo "❌ pre-commit: regenerate script failed."
    failed=1
  }
  after_hash=$(sha256sum src/app/fonts/material-symbols-outlined.woff2 | awk '{print $1}')
  if [ "$before_hash" != "$after_hash" ]; then
    if ! git diff --cached --name-only | grep -q "^src/app/fonts/material-symbols-outlined.woff2$"; then
      echo "❌ pre-commit: woff2 was regenerated but is not staged. Run:"
      echo "   git add src/app/fonts/material-symbols-outlined.woff2"
      failed=1
    else
      echo "✓ pre-commit: woff2 staged + matches script output"
    fi
  else
    echo "✓ pre-commit: woff2 already up-to-date"
  fi
fi
```

#### F004.B README 更新（hook 安装方法）

- [ ] 在 framework/templates/pre-commit-hook.sh 顶部 comment 块加 v0.9.7 sections 说明
- [ ] 如 `framework/README.md` 含 "如何启用 hook"段，更新指向 v0.9.7 多功能版本

#### F004.C 守门测试

- [ ] 新建 `tests/integration/pre-commit-hook.test.ts` 至少 3 case：
  - happy path：staged 文件无 icon 改动 → hook 不跑 regen
  - icon 改动 + woff2 已 staged → hook PASS
  - icon 改动 + woff2 未 staged → hook reject（exit code 非 0）
- [ ] 用 child_process.execSync mock git diff 输出走 hook

#### F004.D 文档加 hook 启用说明

- [ ] `docs/dev/rules.md` 或 README 加新建仓时 `cp framework/templates/pre-commit-hook.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit` 说明
- [ ] 注：hook 是 developer experience 工具，CI 仍是兜底（F003 case #7）

### 估时：~0.4 day

---

## §F005 — PR template Material Symbols checklist 强化

### 实装位置

`.github/pull_request_template.md`（line 18-44 §"Material Symbols icon changes" 段）

### Acceptance

#### F005.A 删除 "Static usage only" 路径

- [ ] 删除当前 `- [ ] Static usage only — every new icon ...`（lines 30-33）+ 整个三选一结构
- [ ] 改为 2 选一 + 子 checkbox（统一对待 static + dynamic）：

```markdown
## Material Symbols icon changes

<!-- Source: BL-025-F009 + BL-027-F005 · Material Symbols subset guard.
     The prod 字符方框 incident traced back to icons that landed
     without running the regenerate script. ALL icon changes (static
     OR dynamic) must run the script + commit woff2. Tick exactly one. -->

- [ ] Not applicable — this PR doesn't touch any Material Symbols icon usage.
- [ ] Has icon changes — all of the following must be true:
      - [ ] If a new icon is referenced through dynamic forms (JSX
            ternary / object value with key ≠ `icon` / array element
            / `return "name"` / `?? "name"` fallback), the icon was
            added to `scripts/material-symbols-icons-manifest.txt`.
      - [ ] `bash scripts/regenerate-material-symbols-subset.sh` ran
            locally and the resulting
            `src/app/fonts/material-symbols-outlined.woff2` is
            committed alongside this PR (regardless of static or
            dynamic usage).
      - [ ] `npm run test:integration -- tests/integration/material-symbols-coverage.test.ts`
            passes (case #7 verifies woff2 ≡ script output).
```

#### F005.B 守门验证

- [ ] PR template 改完 commit
- [ ] 实际 PR 流程不变（GitHub 自动渲染新 template）

### 估时：~0.05 day

---

## §F006 — BL-026 Soft-watch test backfill (S2 + S3 + S4)

### 实装位置

新文件：
- `tests/e2e/assets-page.spec.ts`（覆盖 S2 — 已有 8 case 但 BL-026 要求新增 filter dropdown / drawer / mobile 全屏）
- `tests/integration/assets-empty-welcome.test.ts`（覆盖 S3 — F004 fallback 验证）
- `tests/e2e/outreach-composer-template-select.spec.ts`（覆盖 S4 e2e）
- `tests/integration/composer-load-templates.test.ts` + `src/lib/assets/__tests__/queries.test.ts`（覆盖 S4 search/productId case）

### Acceptance

#### F006.A S2 — assets-page.spec.ts 新增 3 类 case

- [ ] **filter dropdown 行为**：进 /assets → 点 Filter ▾ trigger → Dialog 浮层显示 → 选 product → close → 验证 active filter chip 出现
- [ ] **drawer 打开/关闭**：进 /assets → 点 asset card → drawer 从右滑入 → 点 backdrop → drawer 关闭 → 测 Esc 也关
- [ ] **mobile <768px drawer 全屏**：playwright viewport: 375x667 → 选 asset → drawer 占满全屏（不是 520px）
- [ ] 既有 8 case 跑通

#### F006.B S3 — assets-empty-welcome.test.ts

- [ ] integration test 5 case：
  - empty tenant 进 page.tsx → mode='welcome'
  - 含 user_created asset 的 tenant → mode='normal'
  - mode='welcome' 时 listing 含 5 套 system_seed
  - mode='welcome' 时 banner 文案存在
  - mode='welcome' 时 system_seed asset readOnly=true（quick actions 仅 Duplicate）

#### F006.C S4 — outreach-composer-template-select.spec.ts (e2e)

- [ ] 至少 3 case：
  - happy path：composer 打开 → search "welcome" → 选模板 → fill subject + body → toast
  - product filter：composer → 选 product → list 仅显本 product templates
  - search debounce：快速输入 → 仅最后一次查询触发（≤ 1 fetch in 300ms 窗口）

#### F006.D S4 — queries.test.ts + composer-load-templates.test.ts 加 case

- [ ] queries.test.ts 加 2 case：loadAssetsForComposer search match name + productId filter
- [ ] composer-load-templates.test.ts 加 2 case 同上（integration 层）

### 估时：~0.5 day

---

## §F007 — environment.md 修正 (S10 + S11)

### 实装位置

`.auto-memory/environment.md`

### Acceptance

#### F007.A 更正 staging RAM 8GB

- [ ] 找到现有 staging server 段（如有）→ RAM 8GB（非 16GB）
- [ ] 如无 staging 段，新建 §"Staging 服务器" 含：
  - 机型 / 地区 / IP / SSH / 部署路径 / Env 文件 / PM2 / Postgres / Redis 等（仿照 prod 段格式）
  - **RAM 8GB**

#### F007.B 加 NODE_OPTIONS 部署注释

- [ ] §"扩容信号" 之前 / 部署注意事项段：
  - "**Staging build OOM 兜底**：`NODE_OPTIONS=--max-old-space-size=4096 npm run build`（staging RAM 8GB，默认 1.6GB heap 在 build 阶段 OOM；prod 16GB 不受此限）"
- [ ] 同时同步到 `framework/harness/deploy-patterns.md` §3.2 完整链 checklist 中 step 6 "Build" 的 NODE_OPTIONS 现有写法验证（已含 `--max-old-space-size=4096`，说明 framework 已沉淀，仅 environment.md 需更正）

### 估时：~0.05 day

---

## §S2 数据准备步骤（Reviewer 验收前提）

继承 BL-025/BL-026 staging tenant 数据：
- ≥ 5 条 email asset（含 system_seed + user_created + ai_generated 混合）
- ≥ 1 条 asset 含 totalVariants > 1
- ≥ 1 个 empty tenant（验证 F006.B welcome mode）
- 现有 `seed-bl026-fixtures.ts` 数据沿用（不需要新 fixture）

---

## §S3 Staging deploy 步骤（按 deploy-patterns.md §3.2 完整链）

- [ ] `npx prisma generate`（v0.9.6 [#8] 强制步骤）
- [ ] `npx prisma migrate deploy`（无 migration 也跑，幂等）
- [ ] `pm2 delete kolmatrix-staging && pm2 start ecosystem.config.js --only kolmatrix-staging`
- [ ] `NODE_OPTIONS=--max-old-space-size=4096 npm run build`（S10 staging RAM 8GB OOM 兜底）
- [ ] curl 验证 `/api/health.git_sha` = HEAD
- [ ] 浏览器开 staging /assets ActionBar 验证 filter_alt + arrow_drop_down 渲染为 glyph

---

## §S4 验收 30+ checklist（Reviewer L2）

### Icon hotfix（核心）
- [ ] /assets ActionBar Filter 按钮显示 filter_alt icon glyph（不是字面 "FILTER_ALT"）
- [ ] /assets Sort Select 旁显示 arrow_drop_down icon glyph
- [ ] /assets Filter dropdown 展开时 trigger arrow 切 up 图标
- [ ] /assets-empty-system-seed 路径 ActionBar icon 也正确
- [ ] DevTools Inspect ActionBar SPAN element：computed style font-family="Material Symbols Outlined"
- [ ] **L2 字体子集 spot check ≥ 5 dynamic callsite**（按 v0.9.6 [#6] 严格执行）：
  - filter_alt（ActionBar trigger）
  - arrow_drop_down（ActionBar 2 个）
  - close（drawer header）
  - more_vert（detail panel "..." menu）
  - send（Send to Outreach footer button）
  - 其他至少 1 个 detail panel 内 icon

### F009 反向 case
- [ ] `npm run test:integration -- tests/integration/material-symbols-coverage.test.ts` 全 7 case PASS
- [ ] case #7 失败时 error message 含"Run script + commit woff2"

### Pre-commit hook
- [ ] 模板文件 framework/templates/pre-commit-hook.sh 含 Material Symbols section
- [ ] tests/integration/pre-commit-hook.test.ts 3 case PASS
- [ ] docs/dev/rules.md 含 hook 启用说明

### PR template
- [ ] 模板含 2 选一（Not applicable / Has icon changes 含 3 子 checkbox）
- [ ] 不再含 "Static usage only" 选项

### Soft-watch closure
- [ ] S2: tests/e2e/assets-page.spec.ts 含 filter dropdown / drawer / mobile case
- [ ] S3: tests/integration/assets-empty-welcome.test.ts 5 case PASS
- [ ] S4: outreach-composer-template-select.spec.ts 3 case + queries.test.ts/composer-load-templates.test.ts 加 case
- [ ] S10: environment.md 含 NODE_OPTIONS 注释
- [ ] S11: environment.md 含 staging RAM 8GB

### Visual baseline
- [ ] 4 baseline 重生（en-assets / -drawer-open / -filter-dropdown / -empty-system-seed）
- [ ] 重生后浏览器 spot check 渲染正确（不仅看 PNG 文件存在性）

### 守门
- [ ] CI 全绿（lint / tsc / unit / integration / e2e / build）
- [ ] coverage ≥ 80% 不退化

---

## §S5 风险与缓解

| 风险 | 缓解 |
|---|---|
| visual baseline 重生时 staging 还含旧 woff2 → 重生 baseline 仍含字面字符 | F002 必须先 commit 新 woff2 + staging deploy 完成后再触发 update-visual-baselines workflow |
| F009 case #7 在 CI 慢（script 调 Google Fonts API） | 已有 case #6 同样路径，性能可接受（< 60s timeout）；如确实慢可加 mock fixture |
| Pre-commit hook 在 Mac/Linux/WSL 不一致行为 | 用 sha256sum（POSIX 标准），test 在 WSL 跑过；hook 失败不阻塞 emergency commit（用户可 --no-verify，但默认情况下守门）|
| update-visual-baselines workflow 用 GITHUB_TOKEN push 不触发下游 | per deploy-patterns.md §4.1，followup chore retrigger commit 解决 |
| Generator 实装 hook 时改了模板但 .git/hooks/pre-commit 实际版本未更新 | spec 强调 hook 是 dev-experience 兜底，CI 反向 case (F003) 是真正 gate |

---

## §S6 时间线

| 节点 | 日期 | 状态 |
|---|---|---|
| BL-027 spec lock + status=building | 2026-05-03 ~20:00 | 现在 |
| F002 woff2 hotfix + visual baseline 触发 | 2026-05-03 晚 | 0.1d |
| F003 + F005 done | 2026-05-04 | 0.25d |
| F004 hook + test done | 2026-05-04 | 0.4d |
| F006 + F007 done | 2026-05-05 | 0.55d |
| Reviewer L1+L2 + signoff | 2026-05-05 | 0.3d |
| BL-027 done + framework v0.9.7 sinks（done 阶段 Planner 处理）| 2026-05-05 ~晚 | — |
| Prod redeploy（用户）| 2026-05-05 ~ 06 | 用户手工 |
| BL-020 启动 | 2026-05-06 | 链上 |
| 上线对外客户 | ~2026-05-13 | 不变 |

---

## §S7 framework v0.9.7 沉淀（Planner done 阶段处理，不是 Generator feature）

完整重构后由 Planner 直接 sink（用户已认 BL-027 决议=最严格沉淀）：

1. **`framework/CHANGELOG.md`** 加 v0.9.7 条目（BL-027 hotfix + 4 layer guard sinks）
2. **`framework/harness/material-symbols-pattern.md`** 加：
   - 4 layer guard pattern（PR template + pre-commit hook + CI test 反向 case + L2 spot check）
   - "execution gap" 类 bug 防御（不是 grep coverage gap，是 Generator 知道但没做 step）
3. **`framework/harness/evaluator.md` §13** 强化：
   - "L2 字体子集 spot check ≥ 5 dynamic callsite" 改硬条件（必跑浏览器 inspect element + DevTools 验证 font-family + ligature 替换实际生效）
   - 加新 row：visual baseline 不能仅看 PNG 存在，必须验证 baseline 截图本身是 bug-free 状态（不是 capture-the-bug）
4. **`framework/harness/generator.md`** 加 §"新增 icon 强制流程"：
   - icon 改动必须同 commit 含 woff2 增量（pre-commit hook 已自动）
   - PR template 勾选完整子 checkbox 才能合并

---

## §S8 Out of Scope（明示不做）

- visual baseline 改 mock-render（不依赖真实浏览器）— 工程量大，pre-commit hook + F009 case #7 已足够兜底
- 弃用 Material Symbols 字体子集，改 SVG icon set — 主功能性能 / 体积 / 维护成本评估留 BL-028+ 候选
- 全 src/ 反向 grep 验证（每个 className=material-symbols-outlined 的 sibling text 都在 woff2 字符表）— F003 case #7 已通过 script 自动达成等价覆盖
- BL-026 其他 Soft-watch (S1/S5-S9) 不在本批次 — Reviewer signoff §6 已分类，价值低或 future iteration
- BL-020 安全 mini-batch — 独立批次，05-06 启动
