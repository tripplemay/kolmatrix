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

---

<!-- 新条目从这里开始追加 -->
---

## [2026-05-27] Claude CLI — 来源：BL-078-F005 fix-round 1 / Generator + Planner Kimi

**类型：** 新坑（v0.9.25 候选 #1）

**内容：** **opacity-based dimming 在 WCAG AA contrast 上 fragile — parent opacity × text alpha 双重 dimming kills contrast**。BL-078-F005 实战: 用 `opacity-50` 给 inactive sticky stack 元素做"褪色 inactive"视觉效果, 但当 parent 已带 `opacity-50` + text color 已经是 `oklch(.78 ... / .80)` 类带 alpha 的颜色时, 双重 dimming 让实际 visible contrast 跌破 WCAG AA 4.5:1 阈值, Reviewer L2 audit 直接 fail.

**修复 pattern：** 4 重 distinction 替代 opacity-50:
1. **Icon scale**: active 1.0 / inactive 0.85 (size 区别 active state)
2. **Icon color**: active accent / inactive ink-muted (不动 alpha, 改 color value)
3. **Cell background color**: active 高 contrast bg / inactive 低 contrast bg (bg 区别)
4. **Progress fill**: active gradient / inactive solid muted

**反面：** 任何 active/inactive UI state 默认用 `opacity-X` 都是 a11y trap 候选, 必须先验 contrast ratio. 推荐 grep `opacity-[0-9]+` in landing/marketing components.

**建议写入：** `framework/harness/ui-fidelity-guardrail.md` 或 `evaluator.md` §a11y 验收 checklist 新加段 §"opacity-dimming a11y trap"（含 BL-078-F005 反例 + 4 重 distinction 模板 + grep 防御）

**状态：** 用户 5/27 ack（fix-round 1 完成）— 待 v0.9.25 framework sediment batch 落地

---

## [2026-05-27] Claude CLI — 来源：BL-078-F001 / Generator + Planner Kimi

**类型：** 新规律（v0.9.25 候选 #2）

**内容：** **landing visual token layer 规范模板 — typography / color / spacing / motion 4 类 token 分层**。BL-078-F001 实物落 `src/app/globals.css` @theme 扩展 + `design-draft/landing-v2-tokens.md` 规范文档. 关键经验: landing 视觉精修不应"散乱直接改 component CSS", 必先建 token 层 (single source of truth), components 引 token, 这样未来调 token 即批量调全 landing.

**4 类 token 规范：**
- **Typography**: font scale (hero h1 clamp / section h2 / body lg/base) + line-height (tight/normal/loose) + tracking (tight/normal/wide)
- **Color**: bg layer (base/section) + text layer (primary/muted/subtle) + accent layer (现有 brand 复用 + 新 hero gradient)
- **Spacing**: section-y (clamp 4-8rem) + container-x (clamp 1.5-6rem) + element-y (3 级 tight/normal/loose)
- **Motion**: duration (short 200ms / medium 400ms / long 800ms) + ease curves (out / in-out)

**建议写入：** `framework/harness/ui-fidelity-guardrail.md` 新段 §"landing / marketing 视觉 token layer 规范"（含 4 类 token + design-draft/landing-v2-tokens.md 复用案例）

**状态：** 用户 5/27 ack — 待 v0.9.25 framework sediment batch 落地

---

## [2026-05-27] Claude CLI — 来源：BL-078-F002+F003 / Generator + Planner Kimi

**类型：** 新规律（v0.9.25 候选 #3，扩展 BL-076 ADR 类似)

**内容：** **@view-transition + scroll-driven + interpolate-size 渐进增强模式 — Native CSS 优先 + Firefox/旧 Safari fallback**。BL-078-F002/F003 实物落 view transitions API + animation-timeline 等 Chrome 115+/Safari 18+ 原生 CSS, Firefox/旧 Safari 走 IntersectionObserver 退化 (无 motion 但 navigation 不破).

**渐进增强 pattern：**
```css
/* Native API 优先 */
@supports (animation-timeline: view()) {
  .reveal { animation: fade-in linear; animation-timeline: view(); animation-range: cover 0% cover 30%; }
}

/* Fallback for Firefox / 旧 Safari */
@supports not (animation-timeline: view()) {
  .reveal { /* JS-driven via IntersectionObserver or framer-motion */ }
}

/* prefers-reduced-motion 守门 */
@media (prefers-reduced-motion: reduce) {
  .reveal { animation: none; opacity: 1; }
}
```

**建议写入：** `framework/harness/generator.md` 新段 §"现代 CSS 渐进增强 — Native API + Fallback + reduced-motion 三层守门"（含 BL-078 实战 + 模板）

**状态：** 用户 5/27 ack — 待 v0.9.25 framework sediment batch 落地

---

## [2026-05-27] Claude CLI — 来源：BL-078 plan v2 / Planner Kimi

**类型：** 模板修订（v0.9.25 候选 #4）

**内容：** **Landing / marketing 视觉重做项目: 参考案例提炼方法论 — D2 lock 的 reference URL 是"精神参考"非"像素复刻"**。BL-078 lock Linear (主) + Plausible (辅) 作为视觉 reference, 但 Reviewer L2 验收时 acceptance 是"设计参照 Linear / Plausible 精神 (极简 / white space / 微妙 motion) 在 landing 落地" 不是"像素一致". 这避免了机械复制陷阱 (源/目标产品定位不同, 1:1 复刻可能破坏自身 brand identity).

**Reference 提炼方法论 3 步：**
1. **解构**: 列 reference URL 的 5-10 个视觉信号 (e.g. Linear: dark theme + sans-serif clean + scroll-driven + 极简 hero + subtle gradient)
2. **筛选**: 哪些信号契合 KOLMatrix brand (cyan/purple/navy) + 哪些冲突
3. **抽象**: 落 token layer (F001) 而非直接 copy css

**建议写入：** `framework/harness/planner-checklists.md` §spec acceptance i18n 段附近新加 §"reference URL 提炼方法论 (visual polish 类批次)"

**状态：** 用户 5/27 ack — 待 v0.9.25 framework sediment batch 落地

---

## [2026-05-27] Claude CLI — 来源：BL-078-F005 / Generator + Planner Kimi

**类型：** 新规律（v0.9.25 候选 #5，扩展 BL-078 #1 a11y trap 同主题）

**内容：** **prefers-reduced-motion 守门是 motion 类 batch 的 a11y 必修课**。BL-078 全栈现代化 motion (view transitions + scroll-driven) 设计含三层守门: Native API + Fallback + `prefers-reduced-motion` 退化静态. F005 acceptance 含 "启用系统选项后所有 motion 退化为静态/瞬时切换" 实测.

**Pattern：** 任何 `animation`, `transition`, `transform` 类 motion 必加：
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

或 component 级精细控制 (与 #3 渐进增强模板配套).

**建议写入：** `framework/harness/evaluator.md` §a11y 验收 checklist 加 §"prefers-reduced-motion 守门验证"（与 #1 opacity-dimming 同段 或 §"motion a11y 三件套" 大段含 reduced-motion + opacity-dimming + contrast）

**状态：** 用户 5/27 ack — 待 v0.9.25 framework sediment batch 落地
