---
scope: project-specific
last-updated: 2026-05-26
---

# Material Symbols Subset — Maintenance Pattern

**Source:** BL-025-F009 (sweep done 2026-05-02 → 2026-05-03 after
the prod 字符方框 incident traced to hotfix `bb637a1`).

**Lives at:**
- `scripts/regenerate-material-symbols-subset.sh` — the generator.
- `scripts/material-symbols-icons-manifest.txt` — the explicit
  list for icons the script's grep can't see.
- `src/app/fonts/material-symbols-outlined.woff2` — the shipped
  glyph subset, served by `next/font/local`.
- `tests/integration/material-symbols-coverage.test.ts` — the CI
  guard that catches a regression silently.
- `.github/pull_request_template.md` — the PR-time checklist.

## The 5 categories of "icon name in code" the script must handle

The original BIx-F005-B subset script only matched two literal
forms; the prod hotfix sweep turned up five more dynamic forms
that grep heuristics either miss or flag with too many false
positives:

| # | Shape | Caught by |
|---|---|---|
| 1 | `<span class="material-symbols-outlined">name</span>` (single line) | Pattern 1 |
| 2 | `<span class="material-symbols-outlined">…\n  name\n  …</span>` (multi line) | Pattern 2 |
| 3 | `icon: "name"` constant (audit log meta, sidebar nav, etc.) | Pattern 3 |
| 4 | JSX prop `<MyButton icon="name">` | Pattern 4 |
| 5a | JSX ternary in expression position: `{cond ? "name_a" : "name_b"}` | **manifest** (Pattern 5) |
| 5b | Object value with key ≠ `icon`: `{ up: "trending_up", down: "trending_down" }` | **manifest** |
| 5c | Multi-line array element: `["icon_a", "icon_b", "icon_c"]` (one per line) | **manifest** |
| 5d | Function `return "name";` | **manifest** |
| 5e | `?? "fallback"` in nullish-coalesce | **manifest** |

We trialled grep patterns 6 (array element) + 7 (return statement)
during F009.2 and bailed: the recall lift went from ~88 → ~219
discovered icons, the vast majority of which were not Material
Symbols — non-icon string constants, audit-log action verbs, etc.
The font fetch isn't picky about extras (Google Fonts ignores
unknown names) but the noise made the discovered list misleading
and made the surrounding exclusion regex unmaintainable. **The
manifest is the right home for the dynamic-form cases**: one line
per icon, with a comment pointing at the call site, so a future
sweep can reproduce the audit trail.

## When you add a new icon

1. **If it lands in form 1-4:** the next CI run regenerates the
   woff2 and ships the glyph automatically. Nothing to do.
2. **If it lands in form 5a-5e (or any unfamiliar dynamic shape):**
   - Append a line to `scripts/material-symbols-icons-manifest.txt`:
     ```
     icon_name        # path/to/file.tsx:LINE | <pattern reason>
     ```
   - Run `./scripts/regenerate-material-symbols-subset.sh` locally.
   - Commit the manifest change + the regenerated
     `src/app/fonts/material-symbols-outlined.woff2` together.
3. Reviewer L1 runs the F009.3 guard test
   (`material-symbols-coverage.test.ts`) which fails if:
   - A manifest entry is malformed.
   - The script's pattern pipeline shrinks below ~50 unique icons
     (signal that someone broke the patterns).
   - The shipped woff2 is empty / missing.

## How the prod incident landed

Hotfix `bb637a1` (2026-05-02) — users reported character squares
in `/dashboard` + `/knowledge-base` for ~19 icons:
`trending_flat`, `bookmark_added`, `auto_fix_high`, etc. Root
cause was a mix of forms 5a (JSX ternary) + 5b (object value) +
5c (array element) — the original 4-pattern grep silently missed
all of them, the woff2 shipped without those glyphs, and the
browser fell back to displaying raw Unicode private-use code
points (the boxes).

The sweep added Pattern 4 (JSX prop) inline + the manifest as the
catch-all, regenerated the woff2 to ~9.2KB / 80 icons. F009.1
extended the manifest with the 10 BL-025 icons (`folder_open`,
`auto_awesome`, `restart_alt`, `file_copy`, `archive`,
`unarchive`, `more_vert`, `compare_arrows`, `restore`, `movie`)
ahead of F004 landing so the woff2 was warm by the time those
spans appeared in the codebase. F009.3 codifies the guard test.
F009.4 surfaces the maintenance contract at PR-review time.

## 四层守门（v0.9.7 — BL-027 沉淀）

Material Symbols 字体子集是"沉默 fail"的高危区：grep 漏一个 icon → woff2 缺 glyph → 浏览器渲染字面字符串。BL-026 prod ActionBar 渲染 "FILTER_ALT"/"ARROW_DROP_DOWN" 字面文字源于此。**BL-027 用四层叠加守门保证任何一层都能拦下"漏跑 regen script"：**

| 层 | 文件 | 触发时机 | 拦截内容 |
|---|---|---|---|
| 1. 输入端：manifest 兜底 | `scripts/material-symbols-icons-manifest.txt` | Generator 加 icon 时手动追加 | Pattern 5a-5e 动态形态 grep 抓不到的 |
| 2. 输出端：CI case #7 | `tests/integration/material-symbols-coverage.test.ts` | 每次 push CI | 已生成 woff2 与"现在跑 regen 应该生成的"字节数不一致 → fail，提示"跑 script + commit woff2" |
| 3. 自动化：pre-commit hook | `framework/templates/pre-commit-hook.sh` + `docs/dev/setup.md §9.5` | 本地 commit 前 | 改了 .tsx 含新 icon 但 woff2 没 stage → block 提交 |
| 4. 评审端：PR template | `.github/pull_request_template.md` | PR 创建时 | 强制 PR 作者勾"已跑 regen script + commit woff2" 2-of-N 选项 |

**为什么四层都需要：** 任意单层都可能因人/机器/环境失效（grep 漏型 / hook 没装 / CI flaky / PR 模板被忽略）。多层叠加 = 任意一层 catch 都不会 leak 到 prod。

**新增 icon 操作回顾：** 仍走 §"When you add a new icon" 三步，4 层只是"漏做"时的捕网。

## manifest 增量维护（v0.9.24 — BL-072-F005 沉淀）

**触发场景：** BL-072 prod hotfix Issue #3 — `/match` view-toggle 渲染字面 `"table_rows"` 文字 / 不出现 icon glyph。根因：MatchSummaryBar.tsx:98 `{v === "card" ? "grid_view" : "table_rows"}` 是 Pattern 5a JSX 三元，但 `table_rows` 未在 manifest 注册，woff2 子集不含其 glyph。`grid_view` 因被 discovery/SummaryBar.tsx:83 早期注册，意外捷径 share；表格态没补，prod 暴露。

### 何时必须手工追 manifest（Pattern 5a-5e 形态）

下面这五类 grep 抓不到，**必须**在新增/重命名/迁移时同步 manifest（即便 Pattern 6 ±5 行兜底也建议保 manifest 入口 belt-and-suspenders）：

| 形态 | 例子 | 触发动作 |
|---|---|---|
| 5a. JSX 三元 | `{cond ? "icon_a" : "icon_b"}` | 追两行 manifest，path 含 `file.tsx:LINE | JSX ternary` |
| 5b. 对象 value（key ≠ `icon`） | `{ up: "trending_up", down: "trending_down" }` | 追每个 value 一行，path 含 `file:LINE | object value` |
| 5c. 数组元素（多行） | `["icon_a",\n "icon_b",\n "icon_c"]` | 追每行一条，path 含 `file:LINE | array element` |
| 5d. 函数 return | `return "warning";` | 追 manifest 一行，path 含 `file:LINE | function return` |
| 5e. `??` fallback | `meta?.icon ?? "fallback"` | 追 fallback 字面，path 含 `file:LINE | ?? fallback` |

### manifest 行格式（强制）

```
<icon_name>                 # <path/to/file.tsx:LINE>          | <pattern_label>
```

- icon_name：snake_case，与 Material Symbols Outlined 官方 ligature 完全一致
- path：包含 file path + `:LINE`，**必填**（review 时验真 + 后续 IA refactor 改名能找到）
- pattern_label：5a-5e 中之一（`JSX ternary` / `object value` / `array element` / `function return` / `?? fallback`），便于 reviewer 一眼分类
- 多余字段（`# (BL-XXX-FXXX)` 等标签）可选

### IA refactor 改名时同步 manifest path label

当 `git mv` / 路径迁移导致 manifest path label 失效，**同 commit** 修正 manifest path label，否则下一轮 reviewer 找不到 callsite。例：
- BL-070 `git mv /dashboard /insight` → manifest 多条 `# dashboard/...` path 需改 `# insight/...`
- BL-065 `/discovery + /database → /match` → 多条 `# discovery/...` / `# database/...` path 需改 `# match/...`

回归守门：CI 跑 manifest path label 是否指向真实文件（暂未自动化，靠 reviewer L1 抽样 + Pattern 6 ±5 行 grep 作为 fallback 兜底）。

### Pattern 6 (BL-072-F005) 兜底 + 排除清单维护

`regenerate-material-symbols-subset.sh` Pattern 6 在 `material-symbols-outlined` 字面周围 ±5 行扫描 quoted lowercase 标识符，作为 Pattern 5a-5e 的兜底。**false-positive 排除清单**需随 codebase 演进维护：

- 增 JSX `role="..."` / `tone="..."` / `type="..."` value → 加入 exclusion regex
- 增 Tailwind palette token（`emerald` / `slate` / 等）→ 加入 exclusion regex
- icon name 与排除词同名 → 优先 keep icon（移出 exclusion）+ 同 commit 加 manifest 显式登记，避免反向漂移

判断依据：跑 script 前后 `ICON_COUNT` 应"持平或略增"。若 +3 以上 = 误纳入噪音；若 -1 = 漏排真实 icon（如 BL-072-F005 实测把 `delete|error|info|warning` 误排，需移出 exclusion）。

### Pattern 7 (BL-073-F002) — bare ligature in multi-line span 兜底

**触发场景：** BL-073 prod hotfix Issue #1 — `/campaigns/[id]` 8 个 icon 字面文字暴露（forward_to_inbox / refresh / article / attach_money / error_outline / hourglass_empty / mark_email_unread / verified_user）。Pattern 1 多行 span 仅匹配 `-A 1`（ligature 紧邻 `material-symbols-outlined` 下一行）；实际 codebase 中 className 跨 2-3 行后 ligature 才出现，Pattern 1 漏。Pattern 6 只扫 quoted lowercase 标识符，bare identifier 在自己一行的形态也漏。

**实现：** `regenerate-material-symbols-subset.sh` Pattern 7 在 `material-symbols-outlined` 字面**之后 12 行内**扫"整行只有一个 lowercase_underscore token"的行（缩进 + 单标识符 + 缩进结束）。然后走与 Pattern 6 共享的最终 false-positive exclusion regex（单一清单不分叉，per BL-073 spec §2.3 invariant #3）。

**Pattern 6 → 7 进化路径：**

| 版本 | 形态 | 覆盖范围 | 局限 |
|---|---|---|---|
| Pattern 1 | `<span class="material-symbols-outlined">icon</span>` 同行 | 单行 inline | 多行 className 漏 |
| Pattern 2 | `material-symbols-outlined` 下一行 (-A 1) bare 标识符 | 紧邻 1 行 | className 跨 2-3 行后 ligature 漏 |
| Pattern 3-4 | `icon: "..."` / `icon="..."` 显式 prop | JSX 标准 prop 形态 | 动态形态漏 |
| Pattern 5 | manifest 显式登记 | 上述全漏的 5a-5e 动态形态 | 维护人工 |
| Pattern 6 (BL-072-F005) | `material-symbols-outlined` ±5 行 quoted lowercase | JSX 三元 / 对象 value / fallback | bare on own line 漏 |
| Pattern 7 (BL-073-F002) | `material-symbols-outlined` -A 12 整行单 token | multi-line span 内 bare ligature | （当前已覆盖全部已知形态）|

**维护惯例（与 Pattern 6 共享）：** false-positive exclusion regex 是单源（不分叉），新增 JSX prop / Tailwind token / HTML element 命名空间词时同步加入；ICON_COUNT 增量应在 +1 ~ +3 范围（远超 = exclusion 太宽松；变负 = 漏排真实 icon 需重新评估）。

**当下覆盖核查：** BL-073 实测 Pattern 7 在 manifest 临时去掉 8 行后仍命中全部 8 ligature；Pattern 6+7 + manifest 共同提供 belt-and-suspenders 三层兜底。
