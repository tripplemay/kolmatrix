# KOLMatrix AI Native 产品愿景

> **创建：** 2026-05-10
> **作者：** 用户 + Planner johnsong（联合）
> **决策来源：** ADR-013-ai-native-product-pivot
> **文档性质：** 产品愿景（不是 spec），描述**重构后产品形态**，作为后续 BL-063+ 系列批次的 spec 依据源

---

## §1 核心理念

### 当前产品（"工具 + AI 辅助"）

KOLMatrix 现 MVP（5/9 BL-061 截止状态）是一个**功能完整的 KOL 营销 SaaS**，AI 是若干 feature 之一：

- /discovery 有 SmartMatchDialog（AI 智能匹配，按需触发）
- /campaigns/[id] 有 AiSuggestionsClient（sidebar 推荐区块）
- /outreach composer 有 AI 邮件个性化

**问题：** AI 是侧栏 button mode。用户上手仍按"自己 search → 自己保存 → 自己挑选"的工具式工作流，AI 的存在感弱、价值不显化。

### 重构后产品（"AI 主导 + 工具托底"）

整个产品的**骨架**翻转：

- 用户表达**意图**（什么产品 + 推给谁）
- AI **主动推进**（扫全量 KOL → 排序 → 推荐 + 解释）
- 用户**审阅决策**（接受 / 换一批 / 自然语言 refine）
- AI **执行**（生成触达邮件 / 调度发送 / 跟踪反馈）
- 持续**学习**（用户每次接受/拒绝/refine → AI 偏好更新）

**用户体验从 "我用工具完成我的工作" 变成 "AI 协作者帮我完成我的工作"。**

---

## §2 顶层 IA — 7 路由 → 4 路由

### 当前 IA（7 路由）

```
[Dashboard / Discovery / Database / Campaigns / Knowledge Base / Outreach / Reports]
```

模块化思维：每个工具一个页面，用户在多个页面之间手动切换组装工作流。

### 新 IA（4 路由 + 概念图）

```
┌─────────────────────────────────────────────────────────────┐
│                       KOLMatrix                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│  │ Brief   │ │ Match   │ │ Reach   │ │ Insight │            │
│  │ 输入    │ │ AI 主导 │ │ 执行    │ │ 反馈    │            │
│  │ context │ │ 工作台  │ │         │ │ 优化    │            │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘            │
│                                                             │
│  + KOL Detail (modal/drawer 不占顶级路由) / Settings       │
└─────────────────────────────────────────────────────────────┘
```

围绕**用户意图**而非工具模块组织。每个路由对应一个工作阶段，AI 在每个阶段都有主动行为。

### 路由功能映射

| 新路由 | 原路由 | 核心功能 |
|---|---|---|
| **Brief** | KB（产品库）+ Campaigns/new（活动创建）+ 部分 Dashboard | 产品输入 → 活动创建 → AI 自动 brief 生成（开始扫 KOL 池） |
| **Match** | Discovery（探索）+ Database（saved 池，删除）+ Campaigns/[id]（KOL panel）| AI 推荐主面板 / 全量 KOL 工作台 / batch + filter / 对话式 refine / explainability |
| **Reach** | Outreach（触达 composer + 邮件 thread）| AI 邮件生成 / 个性化 / 调度 / 跟踪 |
| **Insight** | Dashboard + Reports（含 weekly report / ROI）| 数据看板 / 反馈循环 / valueScore 个性化学习状态 |

`/database` 路由完全消失。`/discovery` 概念消失（功能合并进 /match 但定位变成"全量 KOL 工作台"而非"探索"页）。CSV 导入等 admin 工具移到 /admin（不在 marketer 4 路由中）。

---

## §3 五个关键交互场景（画面感）

### 场景 1：Campaign 创建即 AI brief 触发

**当前体验：**
```
1. 进 /campaigns/new
2. 填表（活动名 / 关联产品 / budget / dates）
3. 提交
4. 跳到 /campaigns/[id] 详情页 — KOL panel 是空的，按钮"+ 添加 KOL"
5. 点击按钮 → dialog 弹出 saved pool 列表 → 自己挑
```

**AI Native 体验：**
```
1. 进 /brief（或 /campaigns/new）
2. 填表 + 自然语言加 brief 描述（"Q2 推 Genshin Impact 给东南亚游戏受众，预算 $10K"）
3. 提交
4. 跳到 /match?campaignId=xxx — 已经有 30 个候选 KOL 排好了
5. 每个 KOL 旁边：valueScore 4 维度 + 一句话"为什么"
6. 用户审阅 → ☑ 接受 8 个 / ☐ 换一批 / 输入"减少 micro tier，多加 mid"
```

**关键差异：** 用户不主动"添加 KOL"，AI 主动呈现候选。

### 场景 2：推荐附"为什么"

**当前体验：** Discovery KOL 卡片显 follower / engagement / valueScore 数字。用户自己解读为什么这个 KOL 排前。

**AI Native 体验：** 每个推荐 KOL 旁边一句 LLM 生成的解释：

```
@ninja  ⭐ 4.85
🎯 15.5% engagement (top 5%)，3 个游戏品类匹配你的 Genshin
受众 1100 万，主流是 18-24 岁男性，符合你的目标受众
最近 90 天活跃发帖 23 条，互动稳定
[ 接受 ] [ 跳过 ] [ 详情 ]
```

**关键差异：** AI 替用户做"为什么这个 KOL 适合"的认知工作。

### 场景 3：对话式 Refine（B3 混合）

**当前体验：** Discovery 用 filter 推子（tier / platform / category / follower 区间）+ 排序按钮。

**AI Native 体验：**

```
当前推荐池：30 个 (按 valueScore 排)
─────────────────────────────────────
Filter: [游戏 ▼] [所有 tier ▼] [东南亚 ▼]
─────────────────────────────────────
[ Refine with AI："减少 micro tier，多加女性受众" ]
                                      ↑
            用户输入 → LLM 解析 → 重排
─────────────────────────────────────
新推荐池：30 个 (女性占比 65%，micro 占比 8%)
```

**关键差异：** 用户可以**绕过 filter UI 直接表达意图**。AI 解析"micro tier" / "女性受众"等概念并 re-rank。Filter UI 仍保留作主路径，自然语言是 escape hatch。

### 场景 4：Explainability 双向（C3）

**当前体验：** valueScore 显数字，没有 explanation 接口。

**AI Native 体验：**

```
Top 推荐：@ninja
─────────────────────────────────────
Q: 为什么 @ninja 排在第一位？
A:（用户主动 query 触发 LLM）
   1. valueScore 4.85 / 5.0（前 5%）
   2. 主营品类 Gaming + Esports 与你的 Genshin 重合
   3. 最近 30 天活跃发帖 23 条，互动稳定
   4. 受众 18-24 岁男性占 65%，与你的目标受众重合度 78%
   5. 历史合作过 5 个游戏品牌（Sony, Razer, ...），价格区间 $X-$Y
─────────────────────────────────────
Q: 为什么 @kol45 排在第十位而不是更前？
A:（query @kol45 vs 排前的差异）
   ...
```

**关键差异：** 用户对 AI 决策可问询。这是 AI 协作者 mode 的关键体现。

### 场景 5：持续学习（隐式偏好捕获）

**当前体验：** 没有学习。每次推荐都是相同的 valueScore 公式。

**AI Native 体验：**

```
后台行为（用户不可见）：
- 用户在 campaign A 接受了 5 个 micro / 拒绝了 3 个 mega
- 用户在 campaign B 接受了 7 个 mid / 拒绝了 2 个 nano
- 用户在 campaign C 多次 query "engagement 高的"
─────────────────────────────────────
AI 推断该 marketer 的偏好：
- 偏好 micro / mid tier > mega / nano
- 看重 engagement > follower 总量
- ...
─────────────────────────────────────
下次推荐：
- 自动按学到的偏好调整 4 维度权重
- 推荐解释中突出 engagement 字段
- 在 filter 默认值中预填用户的隐含偏好
```

**关键差异：** AI 把用户的每次操作视为反馈信号，下次更准。

---

## §4 用户旅程图（Marketer 一天工作流）

### 当前旅程（10+ 步骤，多页切换）

```
1. 登录
2. 进 Dashboard 看昨天数据
3. 跳 KB 看产品列表
4. 创建产品 → 提交
5. 跳 Discovery 浏览 KOL，filter / search
6. 看到合适的 → 点保存
7. 跳 Database 看 saved pool
8. 跳 Campaigns 创建 campaign
9. 在 campaign 详情页点"添加 KOL" → dialog → 选 → 加
10. 跳 Outreach composer 写邮件
11. 调度发送
12. 第二天看 Reports
```

12+ 步，5+ 页切换，4 个工具概念（KB / Discovery / Database / Campaigns）。

### AI Native 旅程（5-7 步，2-3 页切换）

```
1. 登录 → 进 Brief（首页或意图输入）
2. 填产品 + 活动描述（自然语言 OK）
3. → 自动跳 Match，AI 已扫好 30 个候选
4. 审阅推荐：☑接受 8 / refine 一次 / ☑接受 5 个
5. → 自动跳 Reach，AI 已为 13 个 KOL 生成个性化触达邮件
6. 用户 review 邮件 → 接受 / 微调 → 调度发送
7. 第二天进 Insight 看反馈 + AI 学到的偏好
```

5-7 步，2-3 页切换，4 路由意图清晰。**步骤少、心智简、AI 显化。**

---

## §5 与现产品对比表

| 维度 | 现产品（工具+AI辅助）| AI Native（重构后）|
|---|---|---|
| 顶级路由数 | 7 | 4 |
| KOL 概念层数 | 3（discovery / database / campaign）| 1（全量池）|
| AI 显化程度 | 侧栏 widget | 主面板 protagonist |
| 用户工作流步骤 | 10+ 步 5+ 页 | 5-7 步 2-3 页 |
| AI 推荐解释 | 数字（valueScore）| 自然语言 + 双向 query |
| Refine 方式 | filter 推子 | filter + 自然语言 |
| 用户偏好学习 | 无 | 隐式捕获 + 个性化 |
| Marketer 心智 | "我要管理工具完成工作" | "AI 协作者帮我做工作" |
| 上手学习曲线 | 陡（多页多概念）| 平（4 路由意图清晰）|
| 与竞品差异化 | 普通 SaaS + AI feature | AI native 品类领先 |

---

## §6 为什么这是差异化

### 市场对 KOL 工具的演进期待

第一代 KOL 工具：人工挖、Excel 管。
第二代（当前主流）：SaaS 化，filter + 数据 + 工具齐全。
**第三代（AI native）：AI 协作者，意图驱动，工具托底。**

KOL 工具品类正处于第二代向第三代的过渡期。先做出 AI native 体验的产品会占据品类心智。

### 客户画像匹配

AI native 体验最大化匹配：
- **中小品牌 marketer**（不熟 KOL 行业，要 AI 帮筛选）— 主流市场
- **快速试错的小团队**（一个人多角色，无暇深挖每个 KOL 数据）— 高频使用
- **跨地区扩展的国际品牌**（多语言、多时区，AI 统一标准）

不太匹配：
- **大型 KOL agency**（要工具齐全 + 团队协作 + 复杂权限）— 不是 KOLMatrix 主目标客户

### 技术差异化护城河

AI native 体验需要：
- 高质量数据源（apify-kol 单源 + 持续 sync 已铺）
- 评分算法（BL-023 4 维度 + 持续优化空间）
- LLM 调用层（aigcgateway 已铺）
- 推荐 explainability（C3 双向，重构期间实装）
- 个性化学习（重构期间或 post-Phase 4 加）

这些组件 KOLMatrix 已部分铺好，重构是把这些能力**前置到主流程**的过程，不是从零起。

---

## §7 重构后的关键设计原则

1. **意图优先**：用户表达"我要推 X 给 Y"，AI 推进所有 mechanical 步骤
2. **AI 显化**：每个用户决策点都伴随 AI 推荐 + 解释
3. **Refine over Filter**：自然语言 refine 是一等公民，filter 推子是 fallback
4. **Explainability 是 contract**：AI 决策必须可解释，黑盒推荐 = 用户不信任
5. **学习是隐式的**：用户不需要"训练 AI"或填偏好表，使用过程就是训练
6. **Tool 是 fallback**：手动操作（如手动加 KOL / 手动 filter）仍可达，但不是主路径
7. **数据持续 sync**：apify-kol 每天 cron sync 新 KOL 是 AI native 体验的物质基础（数据陈旧 → AI 推荐质量下降）

---

## §8 不在愿景范围内（明确划界）

以下不在本次 AI native 重构范围内（避免 scope creep）：

- **多租户协作 / 团队管理 / 权限系统升级** — 现 RLS 多租户够用，post-AI native 评估
- **真客户 dashboard / billing / pricing tier** — 商业化策略另议
- **Mobile responsive** — 用户已明确"团队不会通过移动端使用产品"（BL-019 backlog）
- **CSV 批量导入路径优化** — admin 工具移到 /admin，不优化 UX
- **i18n 翻译质量人工 review**（BL-014）— 跟踪批次独立处理
- **完整对话式产品 /chatbot UI** — B3 混合是"自然语言 refine 作 escape hatch"，不是全局聊天 UI

---

## §9 验证方式（重构完成后回顾）

- AI 推荐用户接受率 ≥ 40%
- 自然语言 refine 使用率 ≥ 10%（marketer 至少试用过一次）
- 用户工作流平均步骤 < 7 步
- 用户从登录到调度第一封邮件的时间 < 10 分钟（vs 当前 30+ 分钟）
- 用户主动 query "为什么"次数 ≥ 1 次/campaign（说明 explainability 起作用）
- 用户反馈定性："AI 帮我筛选 / AI 主导"出现频率 > "工具 / SaaS / dashboard"

数据收集：埋点 / 用户访谈 / 客户使用反馈。

---

## References

- ADR-013-ai-native-product-pivot（核心决策记录）
- docs/product/ai-native-roadmap.md（实施路线图）
- docs/product/KOLMatrix-MVP-PRD.md（原 MVP PRD，部分仍有效）
- BL-023 valueScore 4 维度（AI 推荐排序基础）
- AiSuggestionsClient.tsx + SmartMatchDialog.tsx（现 AI 组件，重构后升级为主面板）
- aigcgateway 集成（ADR-009）— B3 + C3 LLM 调用层
