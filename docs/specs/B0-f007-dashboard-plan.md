# B0 F007 · Dashboard 页面规划稿

> **发起者：** johnsong (Generator)
> **日期：** 2026-04-19
> **触发：** F007 开工前审计，按 "pre-impl 审计 → Planner 裁决" 工作范式
> **状态：** 等待 Planner 明确回复，**未收到前不开工**

---

## 1. 背景 & 目标

F007 实现 Dashboard 页面 5 区块（spec §4）：
1. 问候栏（动态时间 + 名字 + New Campaign CTA）
2. KPI 4 卡（Total KOLs / Active Campaigns / Emails Sent 7d / Avg AI Match Score）
3. Active Campaigns 3 行（进度条 + 指标）
4. AI-Recommended KOLs 2x2 网格
5. Email Performance 14 天 LineChart + Recent Activity feed

**强约束**：
- `page.tsx` JSX ≤ 80 行
- 必须 import 并使用 F010 全部 12 个组件（grep 验证）
- KPI 从 Prisma 查（seed 数据），email chart + activity feed 用 mock
- 像素级还原 `dashboard.png`（±2px / ΔE<2）
- HEX 硬编码扫描零命中

本规划稿提交 7 条决议 + 4 个数据 gap 供裁决。

---

## 2. 5 区块 → F010 组件映射

| # | 区块 | 结构 | F010 组件 | 数据源 |
|---|---|---|---|---|
| 1 | 问候栏 | h2 + p + CTA | `GradientButton` | session.user.name + `new Date()` |
| 2 | KPI 4 卡 | `grid-cols-1 md:2 xl:4 gap-6` | `StatCard` × 3 + **第 4 卡特例** | Prisma + mock trend |
| 3 | Active Campaigns | SectionHeader + 3 × CampaignRow | `SectionHeader` + `GhostButton` + `CampaignRow` | Prisma + openRate gap |
| 4 | AI-Recommended KOLs | SectionHeader + `grid-cols-2 md:4` | `SectionHeader` + `GhostButton` + `KolCard` | Prisma (orderBy aiScore desc take 4) |
| 5 | Email Perf + Activity | 两列 grid（chart + feed） | `EmailPerformanceChart`（非 F010，新建）+ `ActivityFeedItem` × 5 | mock（spec 明文） |

**12 F010 组件 import 分配**：
- `StatCard` ← 区块 2（3 卡用）
- `KolCard` ← 区块 4
- `CampaignRow` ← 区块 3
- `AiScoreBadge` ← KolCard 内部已用；Dashboard KPI 4 独立用（"78" 数字）
- `GlassPanel` ← 包 Email Perf + Activity 右栏
- `GradientButton` ← 区块 1 New Campaign
- `SecondaryButton` ← ⚠️ Dashboard 没有明显用处 → 决议 #7
- `GhostButton` ← SectionHeader "View All" × 2
- `TagChip` ← KolCard 内部已用；dashboard 若不直接 import 算不算违规 → 决议 #7
- `AvatarWithPlatformBadge` ← KolCard 内部已用；同上
- `ActivityFeedItem` ← 区块 5
- `SectionHeader` ← 区块 3 + 4

**风险**：F010 有几个组件（TagChip / AvatarWithPlatformBadge / SecondaryButton）在 Dashboard **没有直接显性用途**。靠 KolCard 间接使用，不算 page.tsx 的 import。→ 决议 #7

---

## 3. 数据源 · 4 个缺口

### 3.1 Prisma Schema 事实核对

✅ `Kol.aiScore: Int?`（seed 12 KOL 都有值）
✅ `Campaign` 模型（seed 有 3 个：Honor of Kings / Genshin / PUBG）
✅ `EmailLog` 模型（`sentAt / openedAt / repliedAt / bouncedAt` 字段齐全）
✅ `recharts@^3.8.1` 已在 package.json
❌ `Campaign.openRate` 字段**不存在**
⚠️ `prisma/seed.ts` **未注入任何 EmailLog 记录**

### 3.2 4 个数据 Gap

| Gap | 影响 | 方案 A | 方案 B | johnsong 建议 |
|---|---|---|---|---|
| G1 | Emails Sent 7d 初始为 0 | 补 seed（100-500 条 EmailLog） | 显示真实 0，后续 B3 再补 | **A**（Demo 体验） |
| G2 | Campaign.openRate 无字段 | 补 schema 字段 + migration + seed 初值 | 用 emailLog 汇总 COUNT(openedAt)/COUNT(sentAt) 计算 | **A**（B 会 N+1 查询） |
| G3 | KPI trend 无历史表 | mock 固定值（+12% / 0% / +5.2%） | 加 `kol_history` 表算周对周 | **A**（超出 B0 范围） |
| G4 | KPI 4 环形进度 SVG | StatCard 扩展 `progressRing` prop | page.tsx 内特例 inline | → 决议 #6 |

G1/G2 需要改 seed.ts + （G2 需）加一次 migration。是否允许 F007 sprint 内做这些？→ 决议 #1。

---

## 4. 80 行 JSX 预算拆分

### 4.1 按 Kimi §11.6 锦囊拆分

**策略**：区块配置/数据映射抽到 `src/features/dashboard/`，page.tsx 只做组合。

```
src/features/dashboard/
├── mocks.ts                       # EMAIL_PERFORMANCE_DATA + RECENT_ACTIVITIES
├── EmailPerformanceChart.tsx      # client component (recharts)
├── KpiRow.tsx                     # 4 张 StatCard + KPI 4 特例
├── RecentActivityCard.tsx         # 包 ActivityFeedItem × 5 的 GlassPanel
└── (可选) GreetingBar.tsx          # 问候栏抽出
```

### 4.2 page.tsx 行数粗估

| 段 | 行数 |
|---|---|
| imports（含 12 F010 barrel + auth + Prisma + features/dashboard/*） | 12-16 |
| `export const metadata` | 1 |
| function 签名 + 退出守卫 | 3 |
| Promise.all 并行查询（5-6 个） | 14-18 |
| JSX 主体（5 区块 + 外层 wrapper） | 38-45 |
| **总计** | **68-83** |

**结论**：预算**非常紧**，可行但需小心。如果决议 #7 规定 page.tsx 必须**直接 import** 全部 12 个（不接受间接传递），则要 `_ = [...]` 虚引用，多占 3-5 行。

### 4.3 JSX 主体草图（示意）

```tsx
return (
  <div className="max-w-[1600px] mx-auto space-y-8">
    <GreetingBar name={session.user.name} />

    <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
      <StatCard label="Total KOLs" value={kolCount} trend={...} icon="groups" sparkline={[40,60,80,100]} />
      <StatCard label="Active Campaigns" value={activeCount} trend={...} icon="campaign" sparkline={...} />
      <StatCard label="Emails Sent" value={emailsSent7d} trend={...} icon="mail" sparkline={...} />
      <AiMatchRingCard score={Math.round(avgAiScore)} />
    </section>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <section>
          <SectionHeader title="Active Campaigns" as="h2" actions={<GhostButton>View All</GhostButton>} />
          <div className="space-y-4">
            {campaigns.map((c) => <CampaignRow key={c.id} {...mapCampaign(c)} />)}
          </div>
        </section>
        <section>
          <SectionHeader title="AI-Recommended KOLs" as="h2" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {topKols.map((k) => <KolCard key={k.id} {...mapKol(k)} />)}
          </div>
        </section>
      </div>
      <div className="space-y-6">
        <EmailPerformanceCard data={EMAIL_PERFORMANCE_DATA} />
        <RecentActivityCard items={RECENT_ACTIVITIES} />
      </div>
    </div>
  </div>
);
```

`mapCampaign` / `mapKol` 放在文件顶部或单独 util。

---

## 5. 7 条 Planner 裁决请求

| # | 决议点 | A 方案 | B 方案 | johnsong 建议 |
|---|---|---|---|---|
| 1 | 补 seed（G1 + G2 + openRate migration）在 F007 sprint 内做 | 合进 F007，一次 PR 搞定 | 拆成独立修补 commit（先做再开 F007） | **A**（避免 sprint 切片） |
| 2 | Email Performance Chart 放哪 | `src/features/dashboard/EmailPerformanceChart.tsx`（Dashboard 独享） | F010 第 13 个（违反 12 锁死） | **A** |
| 3 | Mock 数据组织 | `src/features/dashboard/mocks.ts` 单文件 export | inline 在各组件内 | **A**（后续替换为真实数据友好） |
| 4 | Dashboard 渲染模式 | Server Component（async + auth + Prisma） | Client Component + useEffect + API | **A**（Next 15 最佳实践） |
| 5 | Sarah Chen 名字来源 | `session.user.name` 动态 | 硬编码 "Sarah" | **A**（多租户必须动态） |
| 6 | KPI 4 (Avg AI Match) 环形进度 | 新建 `AiMatchRingCard` 特例组件放 `features/dashboard/`（不扩 StatCard） | 扩 StatCard `progressRing` prop | **A**（StatCard 保持通用，环形是单点特例） |
| 7 | F010 12 组件必须 **直接** 被 page.tsx import 吗？ | 必须直接（grep 12 import 行），间接（通过 KolCard 等）不算 | 接受间接（只要运行时树里有即可） | **B**（强求直接 import 会逼出无意义的虚引用） |

**裁决格式：** `#1:A #2:A #3:A #4:A #5:A #6:A #7:B` 或偏离建议给理由。

---

## 6. Spec 对 #7 的原文

F007 acceptance 原文："`page.tsx` 必须 import 并使用 F010 全部 12 个公共组件，不允许在 page.tsx 内 inline 写同等视觉的 div"。

**原意**：防止在 page.tsx 重写视觉，强制复用组件库。

**现实**：12 组件中 TagChip、AvatarWithPlatformBadge、SecondaryButton 在 Dashboard 没有独立用途，只会被 KolCard 内部消费。如果强求 page.tsx 顶层直接 import 会导致：

```tsx
// 为了 grep 通过
import { TagChip, AvatarWithPlatformBadge, SecondaryButton } from "@/components/common";
void TagChip; void AvatarWithPlatformBadge; void SecondaryButton;
```

这种虚引用**违反 "不允许在 page.tsx 内 inline 写同等视觉的 div" 的本意精神**。建议改为：

**spec 验证口径（裁决 #7 选 B）**：
- `grep -rE "from.*@/components/common" src/app/(app)/dashboard/page.tsx` ≥ 1 条（说明有接入）
- 所有 12 个组件在 Dashboard 渲染树中存在（运行时 React DevTools 或构建产物验证）
- page.tsx 内**不允许** inline 写 card / button / chip / header 等视觉片段（静态 grep 检查）

---

## 7. 原型 bug 加钉

跨页审计新发现（dashboard.html 专属）：

| # | 行号 | 问题 | 处理 |
|---|---|---|---|
| B9 | `dashboard.html:249` | SVG `viewbox` 小写（React 会 warn）| **已在 F010 决议 §11.3 登记为 B6**，F007/F010 实现时用 `viewBox` 驼峰 |
| B10 | `dashboard.html:457-460` | Email Perf 图表用纯 polyline SVG 无坐标轴刻度 | 实现时用 recharts 补齐 Y 轴刻度 + 网格 |

---

## 8. 开工条件

收到 Planner 对 **7 条决议 + 4 个数据 gap 策略** 的明确回复后，johnsong 会：

1. 先做前置 seed 数据补齐（若 #1:A）：
   - 给 Campaign 表加 `openRate Decimal?` 字段 + migration
   - `prisma/seed.ts` 补 3 campaign openRate 初值 + 100-500 条 EmailLog（7 天内分散）
   - 跑 `prisma migrate deploy` + `prisma db seed` 验证
2. 建 `src/features/dashboard/` 下 mocks.ts / EmailPerformanceChart.tsx / AiMatchRingCard.tsx
3. 改 `src/app/(app)/dashboard/page.tsx`（按 §4 草图）
4. 走验收闸门：
   - HEX 扫描 0 命中
   - tsc / lint / build 全绿
   - page.tsx JSX 行数 ≤80（`wc -l` 或 AST 统计）
   - 12 F010 组件按决议 #7 口径验证
5. 本地浏览器核对 /dashboard 渲染
6. push main + 更新 progress.json / features.json (F007 → completed)

**未收到明确回复前不开工。**

---

## 9. 估算开工时长

| 环节 | 预估 |
|---|---|
| Schema migration + seed 补齐（G1/G2） | 0.8 h |
| features/dashboard/ 3 子文件 | 1.0 h |
| page.tsx 改造 + 80 行预算压缩 | 1.5 h |
| 验收闸门 + 本地视觉核对 + 修 | 1.0 h |
| **总计** | **~4.3 h** |

---

## 10. 相关文档

- `docs/specs/B0-foundation-spec.md` §4 F007 — 原规格
- `docs/specs/B0-f010-component-map.md` — F010 规划（先例）
- `docs/specs/B0-app-shell-canonical-review.md` — F005 规划（先例）
- `design-draft/stitch-references/dashboard.html` — F007 视觉基准
- `prisma/schema.prisma` — Campaign 缺 openRate；EmailLog 已有
- `prisma/seed.ts` — 待补 EmailLog + openRate 初值
- `src/components/common/` — F010 12 组件（已产出，barrel 导出）

---

## 11. Planner 裁决（Kimi · 2026-04-19）

F007 pre-impl 审计挖出了 spec 里一个实际冲突（#7）—— 好事，正是 pre-impl 审计价值所在。

### 11.1 §5 7 条决议

**短格式：** `#1:A #2:A #3:A #4:A #5:A #6:A #7:B`

| # | 决定 | 理由 |
|---|---|---|
| 1 | **A** 补 seed + openRate migration 合进 F007 sprint | 三者同属"让 Dashboard 真跑起来"叙事；拆 2 PR 切片反而割裂验收上下文 |
| 2 | **A** EmailPerformanceChart 在 `features/dashboard/` | F010 12 名单硬锁；chart 是 Dashboard 独享实现 |
| 3 | **A** `features/dashboard/mocks.ts` 单文件 | 测试友好 + 后续 B3 换真实数据时 point-of-replacement 清晰 |
| 4 | **A** Server Component | Next 15 App Router 默认最佳实践；SSR + auth + Prisma 自然流 |
| 5 | **A** session.user.name 动态 | 多租户硬要求；seed 已建 Sarah Chen user，session 登录后就是她 |
| 6 | **A** 新 `AiMatchRingCard` 特例 | StatCard 保持通用；环形进度是单点视觉，扩 StatCard 只为这个 case 不合理 |
| 7 | **B** 接受间接使用 + 静态防 inline 检查 | 详见 §11.2 spec 修订 |

### 11.2 决议 #7 深度 — F007 acceptance 口径修订

**原 spec 冲突：**
- 要求 page.tsx 必须 `import` 全部 12 个组件（grep 验证）
- 实际：TagChip / AvatarWithPlatformBadge / SecondaryButton 在 Dashboard 没有独立顶层使用，只被 KolCard 内部消费
- 强求直接 import 会逼出 `void TagChip` 虚引用——**违反 "不允许 inline 重写视觉" 的精神本意**

**裁决：采纳 johnsong 的 B 方案 + §6 新口径。**

F007 acceptance 修订如下（**我来更新 features.json 和 B0-foundation-spec.md**）：

```
旧: page.tsx JSX 总长度 ≤80 行；必须 import 并使用 F010 全部 12 个公共组件，
    不允许在 page.tsx 内 inline 写同等视觉的 div。

新: page.tsx JSX 总长度 ≤80 行；
    (1) page.tsx 直接 import ≥5 个 F010 组件（真实顶层使用的那些）；
    (2) Dashboard 渲染树中 12 个 F010 组件全部出现（直接 page.tsx
        或间接通过 KolCard 等封装引入都算）——通过 import 图静态分析验证；
    (3) page.tsx 内不允许 inline 写 card / button / chip / header 等
        视觉片段（静态 grep 检查：无 <div className="... rounded-xl ..."
        之类直接仿组件样式的写法）。
```

**本意未变：** 强制复用 F010 组件库，防止在 page.tsx 重写视觉。只是"如何验证" 从"必须 12 个直接 import"改为"渲染树包含 + 不 inline"。

### 11.3 §7 原型 bug 补钉

| # | 文件 | 漂移 | 处理 |
|---|---|---|---|
| B9 | dashboard.html:249 | ~重复 B6~ | 已在 F010 裁决 §11.3 登记 |
| B10 | dashboard.html:457-460 | Email Perf 图表纯 polyline 无坐标轴 | F007 实现用 recharts 补 Y 轴 + 网格（加入 README 漂移清单） |

Planner 同步追加 B10 到 `design-draft/stitch-references/README.md`。

### 11.4 4 个数据 gap 的处理（通过决议 #1:A 同意）

| Gap | 处理 |
|---|---|
| G1 Emails Sent 7d = 0 | 补 seed 100-500 条 EmailLog（7 天内分散） |
| G2 Campaign.openRate 无字段 | 加 schema `openRate Decimal? @db.Decimal(5,4)` + migration + seed 初值 |
| G3 KPI trend 无历史表 | mock 固定值（+12% / 0% / +5.2%）—— B3+ 再加 kol_history 表 |
| G4 KPI 4 环形进度 | 通过 #6:A 解决，新建 AiMatchRingCard 特例组件 |

### 11.5 同步文档更新

Planner 立即执行：
1. `features.json` F007 acceptance 改为 §11.2 新口径
2. `docs/specs/B0-foundation-spec.md` §4 F007 acceptance 段落改为新口径
3. `design-draft/stitch-references/README.md` 漂移清单加 B10

### 11.6 额外叮嘱（不阻塞开工）

- Prisma migration 命名建议：`20260419_add_campaign_open_rate`（时间戳 + 动词 + 对象）
- migration 文件头必须加 `-- ROLLBACK: ALTER TABLE campaign DROP COLUMN open_rate;`（BI2 会检查此规范）
- EmailLog seed 的 100-500 条要覆盖 `status: 'sent'` / `'opened'` / `'replied'` / `'bounced'` 四状态，给 F007 chart 4 条曲线真实数据源

---

**johnsong 可立即开工 F007**（无需再确认）。预计 4.3 小时，走 HEX / tsc / lint / build / 80 行检查闸门 → push main。
