# B1 — KOL Database 生命周期 批次规格

> 类型：Business Feature Sprint（业务批次 1）
> 状态：草稿（待 B0 完成 + 用户确认后启动）
> Planner: Kimi · Generator: TBD · Evaluator: Reviewer
> 起草日期：2026-04-18

## 1. 背景与目标

B0 完成后，项目有 Dashboard mock + 真实数据库 + Auth + 公共组件库 + canonical App Shell。但 KOL 数据只是 seed 假数据，无法真正录入/管理。本批次（B1）实现 KOLMatrix 的核心数据资产管理——**KOL 数据库的完整生命周期**：列表浏览、详情查看、新增、编辑、CSV 导入、状态流转、标签管理、批量操作。

完成后，运营人员可以：
- 浏览数据库中所有已入库的 KOL（全文搜索 + 多维筛选）
- 点开任一 KOL 看详情画像
- 手动新增单个 KOL 或 CSV 批量导入
- 编辑 KOL 信息 / 添加标签 / 切换状态（active/working/pending/archived/blacklisted）
- 多选执行批量操作（加标签、改状态、删除）
- 完整的审计日志（谁在什么时候做了什么）

**Definition of Done：**
- KOL Database 列表页 + KOL Detail 页与 Stitch 设计稿像素级还原
- 所有 CRUD + 批量操作通过自动化测试
- 单个用户在 marketer 角色下完整跑一遍：导入 CSV → 浏览 → 编辑 → 加标签 → 改状态 → 删除
- RLS 强制：用户只见自己 tenant 的 KOL

**Out of Scope（明确留给后续批次）：**
- ❌ AI 评分自动执行（B2）—— B1 中 ai_score 字段允许手动设置或保留 seed 值
- ❌ 外部数据回拉（YouTube/TikTok API）（B6）
- ❌ 与 Campaign 的关联管理（B3）—— 本批次 KOL 详情页隐藏 "Add to Campaign" 按钮
- ❌ 邮件外联（B4）—— 详情页隐藏 "Send outreach email" 按钮

## 2. 范围

### In Scope
- `/[locale]/kols` — KOL Database 列表页
- `/[locale]/kols/[id]` — KOL Detail 页
- `/[locale]/kols/new` — 手动新增
- `/[locale]/kols/[id]/edit` — 编辑
- `/[locale]/kols/import` — CSV 导入流程
- `/api/v1/kols/*` — Route Handlers (CRUD + bulk + import)
- `src/features/kol/` — 业务逻辑模块
- 标签 CRUD + 批量应用
- 状态流转（state machine）+ 审计日志
- 测试：unit + integration（80%+ 覆盖率）

### Out of Scope
- AI 评分计算 / 重新评分管道（B2）
- 与 Campaign 的关联管理（B3）
- 邮件触达（B4）
- 外部数据接入（B6）
- KOL Discovery 全球搜索（B5）

## 3. 关键设计决策

| 决策 | 选定方案 | 理由 |
|---|---|---|
| 列表渲染 | Server Component + TanStack Query 客户端排序/过滤 | 首屏 SEO + 客户端流畅 |
| 状态机 | 显式 state-machine 函数（`src/features/kol/state-machine.ts`） | 状态转换合法性强校验，避免乱跳 |
| CSV 导入 | 客户端预览 + dry-run + 批量 insert + 错误行下载 | 减少错误数据入库，UX 友好 |
| 标签存储 | `kol.categories` text[] 字段（已在 B0 schema） | 简单查询用 GIN 索引，复杂统计后续拆专用表 |
| 删除策略 | 软删除（`deleted_at` 字段），列表默认过滤 | 误删可恢复，审计留痕 |
| 批量操作 | 后端 transaction + audit_log 批量写入 | 原子性 + 审计完整 |
| 全文搜索 | PostgreSQL `tsvector` (GIN) on (display_name + handle + bio) | 速度足够，不引入 ES |
| 状态变更通知 | 前端 toast + audit_log（暂无 email/in-app notification） | B5+ 引入通知中心 |

## 4. 状态流转规则

KOL.status 状态机（强校验，禁止非法转换）：

```
              ┌─────────────────┐
              │   pending       │  ← AI 评估中 / 初次入库待审
              └─────────────────┘
                       │
                       ▼ 人工审核通过
              ┌─────────────────┐
              │   active        │  ← 可参与活动
              └─────────────────┘
                  │       │
        ┌─────────┘       └─────────┐
        ▼                            ▼
┌─────────────────┐         ┌─────────────────┐
│   working       │         │   archived      │
│ (in active      │ ──────▶ │ (not in use,    │
│  campaign)      │         │  may revisit)   │
└─────────────────┘         └─────────────────┘
        │                            │
        └─────────────┬──────────────┘
                      ▼ spam/complaint
              ┌─────────────────┐
              │   blacklisted   │  ← 永久禁用，不可恢复
              └─────────────────┘
```

**合法转换（其他全部禁止）：**
- pending → active / archived / blacklisted
- active → working / archived / blacklisted
- working → active / archived / blacklisted
- archived → active / blacklisted
- blacklisted → ❌ 不可转出（永久态）

**自动转换：**
- 加入 active campaign 时 → status 自动 active → working
- 离开所有 active campaign 时 → status 自动 working → active

## 5. 功能列表（10 项）

每条 acceptance 必须可独立验证。

### F001 — KOL Database 列表页（API + UI）
**实现：**
- `src/app/(app)/[locale]/kols/page.tsx`（Server Component，初始数据 SSR）
- `src/features/kol/api.ts`：`listKols(filters, pagination)` 服务端函数
- `src/features/kol/components/KolDatabaseTable.tsx`：列表表格组件（用 B0 F010 公共组件）
- 路由：`GET /api/v1/kols?page=1&limit=12&status=active&platform=youtube&country=US&q=...`
- 支持筛选：status / platform / region / tier / game / tags（多选）
- 支持排序：ai_score / followers / engagement / last_contacted（默认 ai_score desc）
- 客户端用 TanStack Query 接管 pagination + sort（fetch /api/v1/kols）

**Acceptance：**
- 像素级还原 `design-draft/stitch-references/kol-database.png`
- 12 条 seed 数据完整渲染（GamerXia 等）
- 切换 status tab 后表格刷新（不刷新整页）
- 搜索 "@gamerxia" 命中 1 条
- 分页正确（per page 12 / 24 / 48 可选）
- RLS 验证：marketer 账号只见自己 tenant 数据

### F002 — KOL Detail 页（read-only）
**实现：**
- `src/app/(app)/[locale]/kols/[id]/page.tsx`（Server Component）
- 调用 `getKolById(id)`，404 处理
- 渲染 Stitch `kol-detail.png` 8 个 section：hero / AI intelligence panel / metrics strip / audience intelligence / content performance / top videos / collaborations / AI recommendation / outreach history
- "Add to Campaign" / "Send outreach email" / "Save to shortlist" 按钮置灰 + tooltip "Coming in B3/B4"
- "Edit" 按钮跳 `/kols/[id]/edit`
- 显示 audit_log 最近 5 条变更

**Acceptance：**
- 像素级还原 `design-draft/stitch-references/kol-detail.png`
- 访问 `/kols/{seed-gamerxia-id}` 渲染完整 GamerXia 数据
- 不存在 ID 跳 404
- AI 评分细分（4 项：Brand Safety / Audience Quality / Content Quality / Engagement Authenticity）从 `kol.ai_score_breakdown` JSONB 读取
- 受众图表（age / geo / gender / language）从 JSONB 字段渲染

### F003 — KOL 手动新增表单
**实现：**
- `src/app/(app)/[locale]/kols/new/page.tsx`（Client Component）
- `react-hook-form` + zod schema（同步用于 API 校验）
- 必填：display_name / platform / handle
- 选填：country_code / language / follower_count / categories[] / bio
- AI 评分字段不显示（B2 自动算）
- 提交后 POST `/api/v1/kols`，成功跳详情页

**Acceptance：**
- 表单字段与 schema 完全对应
- 必填校验工作正常
- 重复 (tenant_id, platform, handle) 提示 "已存在"
- 创建成功后 audit_log 记录 action=create_kol
- 视觉风格走 Neural Velocity（input 用 ghost border + cyan focus）

### F004 — KOL 编辑表单
**实现：**
- `src/app/(app)/[locale]/kols/[id]/edit/page.tsx`
- 复用 F003 的表单组件
- 预填当前 KOL 数据
- PATCH `/api/v1/kols/[id]`
- 编辑保存后 audit_log 记录 action=update_kol + payload 含 before/after diff

**Acceptance：**
- 编辑成功更新数据库
- audit_log 记录变更字段
- 不允许修改 tenant_id
- 视觉与 F003 一致

### F005 — CSV 批量导入
**实现：**
- `src/app/(app)/[locale]/kols/import/page.tsx`：3-step wizard
  - Step 1: 上传 CSV（拖拽 / 点击）
  - Step 2: 字段映射（CSV 列 → KOL 字段）+ 实时预览前 10 行
  - Step 3: Dry-run 校验（显示错误行） → 用户确认 → 真正导入
- `src/app/api/v1/kols/import/route.ts`：处理 multipart/form-data
- 使用 `papaparse` 解析 CSV
- Dry-run 用 zod schema 校验每行，错误行返回 [{row: 5, errors: ["handle is required"]}, ...]
- 真正导入用 Prisma `createMany` (skipDuplicates=true)，按 (tenant_id, platform, handle) 唯一约束
- 错误行可下载 CSV 标注问题

**Acceptance：**
- 上传 100 行 CSV，预览正确
- Dry-run 标识 5 行错误（缺 handle 等），可下载错误 CSV
- 真正导入成功创建 95 条
- audit_log 记录 action=import_kols + payload={file_name, total, success, failed}
- 重复 handle 跳过不报错

### F006 — KOL 状态流转 API + UI
**实现：**
- `src/features/kol/state-machine.ts`：`canTransition(from, to): boolean` + `validTransitions(from): Status[]`
- 详情页 + 列表行 kebab 菜单提供 "Change status" → 弹出有效目标状态
- POST `/api/v1/kols/[id]/transition` { to: 'archived', reason: '...' }
- 写 audit_log: action=transition_kol_status, payload={from, to, reason}
- blacklisted 不可恢复，UI 二次确认

**Acceptance：**
- 状态转换矩阵完整（pending→active/archived/blacklisted, active→working/archived/blacklisted, ...）
- 非法转换返回 422（如 blacklisted → active）
- audit_log 完整记录每次转换
- 视觉：状态 chip 颜色与 Stitch 一致（active 青 / working 紫 / pending 琥珀 / archived 灰 / blacklisted 红 ghost）

### F007 — 标签管理（CRUD + 批量应用）
**实现：**
- `src/features/kol/tags.ts`：`addTag(kolId, tag)` / `removeTag(kolId, tag)` / `bulkApplyTags(kolIds, tags)`
- 详情页可加/删标签（输入框 + 标签列表）
- 列表页 bulk-action bar 提供 "Apply tags" → 选标签 → 应用到选中 KOL
- 标签存在 `kol.categories` text[] 字段
- audit_log: action=apply_tags / remove_tag

**Acceptance：**
- 详情页加 "VR" 标签后立即显示
- 选 5 个 KOL 批量加 "Top Tier" 标签，全部成功
- 删除标签后字段更新
- audit_log 记录批量操作

### F008 — 批量操作（多选 + apply tag/status/delete）
**实现：**
- 列表页表格首列 checkbox（含全选）
- 选中后底部浮起 glassmorphism action bar（实现 Stitch 设计的 floating bar）
- 操作：Add to campaign（B3 占位禁用）/ Apply tags / Change status / Re-run AI evaluation（B2 占位禁用）/ Export CSV / Delete
- 删除是软删除（设置 deleted_at），列表默认隐藏
- 所有批量操作走 transaction + audit_log

**Acceptance：**
- 选 4 行 → bar 显示 "4 KOLs selected"
- 批量改状态成功
- 软删除后列表不显示，但 DB 仍有记录
- audit_log 一条 bulk action 包含全部 KOL ID

### F009 — KOL 全文搜索（PostgreSQL tsvector）
**实现：**
- migration 加 `kol.search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(display_name,'') || ' ' || coalesce(handle,'') || ' ' || coalesce(bio,''))) STORED`
- GIN 索引 on `search_vector`
- API `?q=keyword` 用 `WHERE search_vector @@ websearch_to_tsquery('english', $1)`
- 列表页搜索框接入

**Acceptance：**
- 搜 "FPS" 命中 GamerXia / TacticalAce / FragMasterJP 等
- 搜中文 "原神"（如有 Chinese seed）正常工作（用 simple dictionary）
- 搜 "@gamerxia" 命中 1 条
- 性能：1247 行 seed 下 < 50ms

### F010 — 测试套件（unit + integration）
**实现：**
- `src/features/kol/__tests__/`：unit tests
  - state-machine.test.ts（合法/非法转换）
  - tags.test.ts
  - api.test.ts（mock prisma）
- `tests/integration/kol-database.test.ts`：integration tests
  - 完整 CRUD 流程
  - RLS 隔离（marketer A 不能访问 marketer B 的 KOL）
  - CSV 导入 100 行 + dry-run + 错误行下载
  - 批量操作原子性
- 使用 Vitest + Testcontainers（PostgreSQL 临时实例）
- 覆盖率 ≥ 80%

**Acceptance：**
- `npm test` 全绿
- `npm test -- --coverage` 显示覆盖率 ≥ 80%
- RLS 集成测试明确验证 cross-tenant 隔离

## 6. 依赖关系

```
F001 → F002 (Detail 复用 KolCard)
F001 → F003 (新增表单复用 form 模式)
F003 → F004 (Edit 复用 form)
F003 → F005 (CSV 走相同 schema 校验)
F006 / F007 / F008 → F001 (UI 集成在列表页)
F009 → F001 (搜索接入列表)
F010 跨阶段，最后写
```

**强制执行顺序：** F001 → F002 → F003 → F004 → F005 → F006 → F007 → F008 → F009 → F010

## 7. 风险与对策

| 风险 | 对策 |
|---|---|
| CSV 导入大文件性能 | 限制 5000 行 / 5MB；超出报错并提示分批 |
| 状态机硬编码漂移 | 单元测试覆盖完整转换矩阵；UI 用 `validTransitions()` 动态生成菜单 |
| 标签数据膨胀 | 用 GIN 索引；后续如需统计/管理迁移到独立 tag 表 |
| 全文搜索多语言 | English dict 适用 EN/JP/KR 关键字；中文用 simple dict 保底 |
| 软删除恢复 UI | B1 不实现"已删除回收站"，先记录在 DB；B5 加恢复功能 |

## 8. 验收方式（Evaluator 阶段）

由 Reviewer (Codex) 执行：

### L1 — 自动化测试
- `npm test` 通过 + 覆盖率 ≥ 80%
- `npm run build` + `tsc --noEmit` + `lint` 全绿
- HEX 硬编码扫描（`grep -rE '#[0-9a-fA-F]{6}' src/` 在 globals.css 之外为 0）
- 状态机测试覆盖全部合法 + 非法转换

### L2 — 视觉回归
- `/kols` 截屏对比 `design-draft/stitch-references/kol-database.png`（间距 ±2px / ΔE<2 / 字号 100%）
- `/kols/[id]` 截屏对比 `kol-detail.png`
- 批量 action bar 浮起状态视觉对照

### L3 — 端到端用户流
Reviewer 用 marketer 账号手动跑一遍：
1. 访问 `/kols` 看到 12 条 seed
2. 搜 "FPS" 过滤
3. 点开 GamerXia 详情
4. 点 Edit 改 follower_count，保存
5. 详情页 audit_log 出现"updated by marketer X 2s ago"
6. 回列表，加新 KOL "TestKOL_001"
7. CSV 导入 50 行（含 5 行错误），dry-run + 修正 + 真正导入
8. 选 5 行批量改状态为 archived
9. 验证列表默认不显示 archived
10. 切到 admin 账号，验证 audit_log 完整

## 9. 引用文档

- `docs/specs/PRD.md` — KOL 数据库管理 (P0 #3)
- `docs/specs/B0-database-schema.md` — kol 表结构
- `docs/dev/architecture.md` — RLS / API 约定
- `design-draft/design-system.md` — 视觉规范
- `design-draft/stitch-references/kol-database.png` — 列表页基准
- `design-draft/stitch-references/kol-detail.png` — 详情页基准
- `docs/specs/roadmap.md` — 整体路线（B1 在路线图中位置）

## 10. 启动检查清单（Planner 在 B0 完成后启动 B1 时核对）

- [ ] B0 status=done，全部 features 验收通过
- [ ] B0 evaluator signoff 报告存在
- [ ] johnsong / 当前 generator 已休息，无未完成会话
- [ ] kol-database.png 与 kol-detail.png 与最新设计同步
- [ ] B0 实际 schema 与本 spec §4 状态机字段匹配（如有差异修订本 spec）
- [ ] 用户确认 B1 范围（如不要 CSV 导入可剥离 F005，缩到 9 features）
- [ ] role_assignments 决定（默认 generator=johnsong / evaluator=Reviewer）
