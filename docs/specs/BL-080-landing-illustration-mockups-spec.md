# BL-080 Landing Illustration Mockups Spec — AI 生成 illustration 替代真截图

> **Sprint：** BL-080-landing-illustration-mockups
> **Type：** Visual polish v2（BL-078 同维度深化）— 0 业务代码逻辑改动，仅 image asset + components Image 引用 + i18n alt
> **预估工时：** ~10h Generator + 0.5 day Reviewer + 用户 AI gen 0.5-1 day（critical path 在用户）
> **关联：** BL-078 done @ tag bl078-done @ 4d62610 + 5/27 用户反馈 "落地页使用了截图作为系统功能的示意图，冲击力和视觉效果不够好"
> **状态：** A0+A1 完成 → 待 BL-079 done 后 building
> **依赖：** BL-079 v0.9.25 framework sediment done（避免 Generator context switching）

---

## §1 背景与触发

### 1.1 用户 5/27 反馈

> "我认为落地页还需要再进行一轮优化" + "落地页使用了截图作为系统功能的示意图，我认为冲击力和视觉效果不够好"

BL-078 视觉精修 done（perf 0.99 + a11y 1.0 + contrast 0）已达旗舰水准；本批次专攻**产品截图视觉冲击力**。

### 1.2 现状

- public/landing/screenshots/ 含 **7 张产品 PNG**：match-full / crm-full / reach-full / reach-domain-health / roi-full / insight-full / match-ai-sidebar
- 使用 components：HeroVideo / Features / EmailCenterDemo / BeforeAfter
- 痛点：真截图密度高 + 视觉质感不够冲击 + 与 Linear/Vercel 等顶级 SaaS landing 风格落差

### 1.3 A1 用户 5/27 lock（4 子决策）

| 决策 | Lock |
|---|---|
| 升级强度 | 极重度 — 引入 illustrated mockups 替代真截图 |
| Illustration 来源 | AI image generation（DALL-E / Midjourney / SD），用户跑 |
| 覆盖范围 | 全量替换 ~8 张：Hero + Features 6 modules + EmailCenterDemo + BeforeAfter |
| Generator 是否提供 prompt template | 是 — Generator 产出 N 个 detailed AI prompts（含 brand spec / style / subject）|

### 1.4 角色分配

role_assignments = null（默认映射）

---

## §2 整体范围 / 边界

### 2.1 IN-SCOPE

- F001 Generator 产出 8 个 detailed AI prompt templates（含 KOLMatrix brand spec）→ user
- F002 用户 AI 生成 PNG（critical path 外部）— Planner / Generator 等待
- F003 Generator 集成 PNG 到 public/landing/illustrations/ + 替换 Hero / Features / EmailCenterDemo / BeforeAfter Image 引用
- F004 next/image 优化 + LCP 验证 + fallback handling（如某 illustration 未交付保现真截图）
- F005 visual baseline regen + Lighthouse perf + a11y verify
- F006 Reviewer L1+L2 + signoff

### 2.2 OUT-OF-SCOPE

- 11 components 结构 / sections 顺序 / 文案 / 业务路径 全保（BL-078 lock 延续）
- 5 locale 文案不动（仅可能 i18n alt text 微调）
- 性能门槛降级（保 BL-078 标准 perf ≥85 / LCP <2.5s / CLS <0.05 / TBT <200ms）

### 2.3 不变量

1. **真截图保留作 fallback**：public/landing/screenshots/ 不删，components 引用层 conditional fallback（如 illustration PNG 未交付保现状）
2. **brand consistency**：所有 AI illustration 必须 navy bg + cyan/purple accent + dark theme + modern minimal SaaS aesthetic
3. **业务路径不破**：CTA → /request-access form + wantsDemo waitlist 链路不变
4. **a11y 不 regression**：illustration 必有 alt text（i18n）+ decorative 标 aria-hidden
5. **LCP 关键路径**：Hero illustration 优化 next/image priority + preload + 适当尺寸（避免 1MB+ PNG）

---

## §3 实施 Phase（Critical Path 含用户 AI gen）

| Phase | 范围 | 工时 | 谁做 |
|---|---|---|---|
| **A0+A1** | 现状审计 + 4 子决策 lock | ✅ done |
| **B** | F001 Generator 产出 8 prompt templates | 2h | Generator |
| **C** | F002 用户 AI 生成 PNG + 提供 | 0.5-1 day | 用户（critical path）|
| **D** | F003 Generator 集成 PNG + 替换 component Image 引用 | 3h | Generator |
| **E** | F004 next/image 优化 + LCP 验证 + fallback | 1.5h | Generator |
| **F** | F005 baseline regen + perf + a11y | 1.5h | Generator |
| **G** | F006 Reviewer L1+L2 + signoff | 1.5h | Codex |

**总（不含用户 AI gen）：** ~9.5h Generator + 0.5 day Reviewer  
**含用户：** ~1.5-2 day 全闭环

---

## §4 Features 详细描述

### F001: Generator 产出 8 detailed AI prompt templates

**Why：** 用户跑 AI gen 时若无 prompt 指引会反复 iteration + brand 不一致。Generator 出 detailed prompts 提高 first-shot 成功率。

**What：** 产出 docs/specs/BL-080-illustration-prompts.md 含 8 个 prompt templates：

每个 prompt 含：
- **Subject**: 目标 illustration 主题（如 "KOL discovery workspace dashboard with AI recommendations sidebar"）
- **Style**: "modern minimal SaaS UI, flat illustration with subtle gradients, isometric or front-facing"
- **Brand colors**: "navy background #0a0e1a, cyan accent #00e5ff, purple accent #b388ff, dark theme"
- **Composition**: "centered with breathing room, sharp clean lines, dashboard cards, data visualization"
- **Mood**: "professional, futuristic, AI-powered, B2B SaaS"
- **Avoid**: "no photorealistic, no text labels (Generator will overlay i18n), no logos"
- **Output spec**: "1920x1200 (16:10 widescreen) or 1200x800 for Features cards, PNG with transparent or solid bg, ~500KB-1MB target"

8 prompts:
1. **Hero illustration**: KOLMatrix workspace overview（dashboard + AI sidebar + KOL cards）
2. **Features card #1 - Brief AI**: AI brief creation interface
3. **Features card #2 - Match**: KOL matching workspace with filter sidebar
4. **Features card #3 - Reach**: Email outreach composer + tracking
5. **Features card #4 - Insight**: Analytics dashboard + reports
6. **Features card #5 - CRM**: KOL relationship pipeline
7. **EmailCenterDemo main**: Email center with composer + sent tracking + replies
8. **BeforeAfter pair**: Manual KOL search chaos vs AI-organized workspace（同一 illustration 含 2 panels）

**Acceptance：**
- [ ] docs/specs/BL-080-illustration-prompts.md ≥150 LOC，含 8 prompts 完整模板
- [ ] 每 prompt 包 Subject / Style / Brand colors / Composition / Mood / Avoid / Output spec 7 sections
- [ ] brand color codes 精确（# hex）
- [ ] 给用户的 prompt 直接复制粘贴 → DALL-E / Midjourney / SD 可跑
- [ ] L1 PASS

---

### F002: 用户 AI 生成 + 提供 PNG（外部，Generator 等待）

**Why：** User-driven creative phase，Generator 无法替代。

**What（用户做）：**

1. 用户跑 AI image gen（DALL-E / Midjourney / SD）按 F001 prompts
2. iterate prompt 直到 brand consistency 达标
3. PNG 命名规范：
   - `hero-illustration.png`
   - `feature-brief.png` / `feature-match.png` / `feature-reach.png` / `feature-insight.png` / `feature-crm.png`
   - `email-center-illustration.png`
   - `before-after-illustration.png`
4. 放 public/landing/illustrations/ 目录
5. 通知 Generator "illustrations 已就绪 N/8"

**Acceptance（Generator 验收用户产出）：**
- [ ] public/landing/illustrations/ 含 ≥6/8 PNG（允许部分缺，缺的回 fallback 真截图）
- [ ] 每 PNG 尺寸适配 next/image（≤1MB / WebP 优化候选）
- [ ] brand color 抽样：navy bg + cyan/purple accent 视觉一致
- [ ] 无 photorealistic / 无大量 text labels

---

### F003: Generator 集成 PNG + 替换 component Image 引用

**Why：** F002 PNG 就绪后 Generator 接入 components。

**What：**

1. `src/app/[locale]/(marketing)/_components/HeroVideo.tsx`：
   - 加 illustration overlay 或替换 video poster（保 video 优先 + illustration fallback）
   - 或独立 `HeroIllustration.tsx` 与 video 同位（按 BL-078 token 风格）

2. `src/app/[locale]/(marketing)/_components/Features.tsx`：
   - 6 module cards 替换现 screenshot 为 feature-{module}.png illustration
   - 保 Linear 风 card + hover lift（BL-078 token）

3. `src/app/[locale]/(marketing)/_components/EmailCenterDemo.tsx`：
   - 替换 match-full.png 为 email-center-illustration.png
   - 保 sticky-parallax callouts

4. `src/app/[locale]/(marketing)/_components/BeforeAfter.tsx`：
   - 替换为 before-after-illustration.png（含 2 panels 对比）
   - 保 sticky row-highlight motion

5. **Fallback 守门**：components 加 conditional 检测 illustration PNG 是否存在，缺则保现 screenshot fallback
6. i18n alt text 复用现有 `screenshotAlt` 或加新 `illustrationAlt` keys（5 locale 同步）

**Acceptance：**
- [ ] 4 components Image 引用替换为 illustration（如 PNG 全到位）
- [ ] Fallback handling 防 PNG 未交付时不破渲染
- [ ] 5 locale alt text 完整（如新加 keys 5 locale 全译）
- [ ] L1 PASS

---

### F004: next/image 优化 + LCP 验证 + fallback handling

**Why：** Illustration PNG 可能比现截图大（AI 输出常 1-2MB），LCP 关键路径 Hero 必须优化。

**What：**

1. Hero illustration: next/image `priority` + `quality={85}` + 适配尺寸 + AVIF/WebP 转换
2. Features cards illustration: lazy load + `quality={80}`
3. EmailCenterDemo / BeforeAfter: lazy load
4. Bundle size check：所有 illustrations 总 size < 5MB（不计 video poster）
5. LCP 验证：Lighthouse Desktop logged-out LCP < 2.5s（per BL-070 + BL-078 标准）

**Acceptance：**
- [ ] Hero illustration `priority` + 优化设置
- [ ] 其他 illustrations lazy load
- [ ] Lighthouse LCP < 2.5s（不 regress vs BL-078 530ms baseline，允许 ≤1.5s 区间）
- [ ] CLS < 0.05（per BL-070 #29+#30 skeleton 像素镜像守门）
- [ ] L1 PASS

---

### F005: visual baseline regen + 5 locale + Lighthouse + a11y verify

**What：**

1. GitHub Actions update-visual-baselines.yml workflow 跑（4 viewport × 5 locale × 4 affected components）
2. Lighthouse Desktop logged-out 实测 6 项门槛全 PASS
3. a11y verify: keyboard nav + focus visible + alt text + contrast WCAG AA
4. 5 locale spot check（ja / ko / es 长字符 + illustration aspect ratio 适配）

**Acceptance：**
- [ ] visual baseline regen 完成
- [ ] Lighthouse perf ≥ 85 / LCP < 2.5s / CLS < 0.05 / TBT < 200ms / SEO ≥ 90 / a11y ≥ 90
- [ ] a11y 4 项 PASS
- [ ] 5 locale 无 illustration overlap / 不溢出

---

### F006: Reviewer L1+L2 + signoff

**L1：** lint + tsc + npm test + Lighthouse 自动化  
**L2：** staging /zh + /en + /ja + /ko + /es Hero / Features / EmailCenterDemo / BeforeAfter 视觉冲击力主观评估（用户参与最终签收，因主观）

**Acceptance：**
- [ ] L1 5 项 + L2 4 sections 视觉冲击力 acceptable
- [ ] 0 perf regression
- [ ] 0 业务路径破坏
- [ ] signoff doc

---

## §5 风险 / 应对

| 等级 | 风险 | 应对 |
|---|---|---|
| **🟡 MEDIUM** | AI 生成 illustration brand 不一致 / 质量参差 | F001 详细 prompt + 用户 iterate 直到满意；F003 加 fallback 守门 |
| **🟡 MEDIUM** | AI 创作周期超 1 day | F003-F006 不开工直到 ≥6/8 illustrations 就绪；缺的 fallback |
| **🟡 MEDIUM** | LCP regression（illustration size 大）| F004 next/image priority + quality 调 + WebP/AVIF 转换；超阈回退真截图 |
| **🟢 LOW** | 5 locale alt text 漏译 | F003 acceptance 强制 5 locale 完整 |
| **🟢 LOW** | 视觉主观评估难 acceptance | F006 L2 含用户参与主观签收（不依赖 Reviewer 完全决定）|

---

## §6 Done Definition

- [ ] F001-F006 全 acceptance PASS
- [ ] Reviewer L1+L2 + 用户主观确认视觉冲击力升级
- [ ] progress.json status = done
- [ ] ≥6/8 illustrations 就绪（剩余 fallback 真截图）
- [ ] Lighthouse perf 不 regress
- [ ] backlog.json BL-080 移除
- [ ] .auto-memory/project-status.md DONE marker

---

## §7 后续

- BL-080 done 后 prod deploy 让用户实测视觉冲击力升级
- 沉淀候选：AI illustration brand consistency 模板 / fallback 守门模式
- Phase 5 / 真客户 onboarding 等
