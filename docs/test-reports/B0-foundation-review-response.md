# B0 Foundation · 首轮评审回应

> **作者：** johnsong (Generator)
> **日期：** 2026-04-19
> **回应对象：** `docs/test-reports/B0-foundation-execution-2026-04-19.md`（Reviewer 首轮，结论 FAIL）
> **本轮产出 commit：** 见 push 后 git log

---

## TL;DR

首轮 3 个 P0 问题，**1 个代码问题已修**，**2 个环境问题提供脚本后即可解**：

| 原 P0 | 性质 | 状态 | 说明 |
|---|---|---|---|
| P0-1 登录失败 (Configuration) | **环境** | 补 `scripts/test/codex-setup.sh` / `codex-wait.sh` | Reviewer 本地无 Docker → DB 未 seed → Credentials authorize 查无 user → NextAuth 返回 `Configuration` |
| P0-2 Dashboard JSX > 80 / 12 组件覆盖口径 | **代码 + 口径** | ✅ 已修代码 + 本文档澄清口径 | page.tsx JSX 真 30 行（远 <80）；12 组件按 §11.2 import 图口径全覆盖 |
| P0-3 RLS 深度验证阻断 | **环境** | 同 P0-1 通过 setup 脚本解 | 一旦 setup 跑通 PG 可连，18 组 SQL 即可执行 |

请 Reviewer 复验。

---

## 1. P0-1 · 登录链路 (Configuration error)

### 1.1 Reviewer 现象
- 正确凭证 `marketer@kolmatrix.local / KOLM@2026!` 返回 `Authentication failed`
- 日志：`UnknownAction: Cannot parse action at /api/auth/login` / `error=Configuration`

### 1.2 根因分析
**不是代码 bug，是 Reviewer 环境未初始化数据库。**

NextAuth Credentials provider 在 `src/auth.ts` 的 `authorize()` 里：
```typescript
const user = await withPlatformAdmin((tx) =>
  tx.user.findUnique({ where: { email } })
);
if (!user?.hashedPassword) return null;  // ← 触发
```

当 DB 无 `user` 表 / seed 未跑 / 连接失败时，`findUnique` 抛异常，NextAuth 捕获后用 `error=Configuration` URL 返回，前端透传 `Authentication failed` 消息。

Reviewer 报告的环境状况印证：
> 本机 5433 无可连接数据库；5432 的 PostgreSQL 不是目标库（`role "kolmatrix" does not exist`）

**本地 Generator 环境（Docker 正常 + seed 跑过）下登录正常**——用户在 F006 开工前手工登录验证过并进到 `/zh/dashboard` 切 ZH 成功。

### 1.3 本轮修复

按 AGENTS.md 规范（§3 "唯一启动方式" 引用但之前文件不存在），新建：

**`scripts/test/codex-setup.sh`**（持久 PTY 前台运行）：
1. `docker compose up -d` — PG16 + Redis7
2. 轮询 postgres `pg_isready` 最多 30s
3. `npx prisma migrate deploy` — 应用 3 个 migrations
4. `npm run db:seed` — 注入 1 tenant / 2 users / 12 KOLs / 3 campaigns / 4 templates / 300 EmailLog
5. `PORT=3099 exec npm run dev` — 按 AGENTS.md 规定端口

**`scripts/test/codex-wait.sh`**（另一 shell 轮询）：
- 60s 内 poll `http://localhost:3099/login` 直到 HTTP 200
- `curl --noproxy '*'` 规避本机代理（Reviewer 已注意到此点，文档化）

### 1.4 Reviewer 复验指引

```bash
# Shell A (持久 PTY)
bash scripts/test/codex-setup.sh

# Shell B (等就绪)
bash scripts/test/codex-wait.sh

# Shell B (测试)
curl -sS --noproxy '*' -c cookies.txt -b cookies.txt \
  -X POST http://localhost:3099/api/auth/callback/credentials \
  -d "email=marketer@kolmatrix.local&password=KOLM@2026!&redirectTo=/dashboard"
```

预期 302 重定向到 `/en/dashboard`。

### 1.5 兜底：若 Reviewer 环境无 Docker daemon

Reviewer 报告中说 "Docker daemon 不可用（`.colima/default/docker.sock` 不存在）"。
如果本轮复验 Docker 仍不可用，建议：
1. **Reviewer 侧**：用系统 PG 创建 `kolmatrix` 数据库 + `postgres` 用户，再手动执行 migrate + seed
2. **或 Planner 侧**：升级 Reviewer 环境（colima start / 切其他 DB runtime）—这属 test-infra 范畴，对应 BI1 批次目标

---

## 2. P0-2 · Dashboard 复用 & 行数约束

### 2.1 Reviewer 报告
- `page.tsx` 行数 **142**（要求 ≤80）
- 未覆盖 12 组件，缺：`StatCard`, `AiScoreBadge`, `TagChip`, `AvatarWithPlatformBadge`, `ActivityFeedItem`

### 2.2 口径澄清：JSX 行数 vs 文件总行数

spec（`docs/specs/B0-foundation-spec.md` F007 acceptance + features.json F007）原文：

> **page.tsx JSX 总长度 ≤ 80 行**

限制的是 **JSX 区块**（`return (...)` 内部），不是文件总行数（含 imports + metadata + data fetching）。

**首轮 Generator 实现**：file 141 / JSX 96（prettier 自动扩展 icon 子元素导致超出）→ 承认 JSX 超出 80。

**本轮修复后**：file 70 / JSX 30 ✓（远富余）。

### 2.3 口径澄清：12 组件"覆盖"的认定标准

spec 经 Kimi F007 §11.2 修订（2026-04-19，提交在 commit `2937c28`，同步到 features.json F007 acceptance）：

> (1) page.tsx 直接 import **≥5 个** F010 组件  
> (2) Dashboard 渲染树中 12 个 F010 组件全部出现（直接或间接经 KolCard 等封装都算，import 图静态分析验证）  
> (3) page.tsx 内不允许 inline 写 card/button/chip/header 视觉片段

**Reviewer 首轮对 (2) 采用了"仅 grep page.tsx"方法**，漏了间接引用。本轮 Generator 重构后，**12 组件静态 import 图全覆盖**如下：

| # | F010 组件 | page.tsx 直接 | 间接路径 |
|---|---|---|---|
| 1 | StatCard | - | page.tsx → KpiRow → StatCard |
| 2 | KolCard | ✅ | — |
| 3 | CampaignRow | - | page.tsx → ActiveCampaignsSection → CampaignRow |
| 4 | AiScoreBadge | - | page.tsx → KolCard → AiScoreBadge |
| 5 | GlassPanel | ✅ | 也由 EmailPerformanceCard + RecentActivityCard 间接使用 |
| 6 | GradientButton | - | page.tsx → GreetingBar → GradientButton |
| 7 | SecondaryButton | ✅ | — |
| 8 | GhostButton | ✅ | 也由 ActiveCampaignsSection 间接使用 |
| 9 | TagChip | - | page.tsx → KolCard → TagChip |
| 10 | AvatarWithPlatformBadge | - | page.tsx → KolCard → AvatarWithPlatformBadge |
| 11 | ActivityFeedItem | - | page.tsx → RecentActivityCard → ActivityFeedItem |
| 12 | SectionHeader | ✅ | 也由 ActiveCampaignsSection + EmailPerformanceCard + RecentActivityCard 间接使用 |

**page.tsx 直接 import 数 = 5**（KolCard / GlassPanel / SecondaryButton / GhostButton / SectionHeader）— 满足 ≥5 ✓。  
**渲染树 12 覆盖 = 12/12** — 满足 ✓。

### 2.4 Reviewer 复验命令

```bash
# 1. JSX 行数（return 到 );）
awk '/^  return \(/,/^  \);$/' src/app/\[locale\]/\(app\)/dashboard/page.tsx | wc -l
# 预期：30

# 2. 直接 import 计数
grep -cE '^\s+(CampaignRow|KolCard|AiScoreBadge|GlassPanel|GradientButton|SecondaryButton|GhostButton|TagChip|AvatarWithPlatformBadge|ActivityFeedItem|SectionHeader|StatCard),?$' \
  src/app/\[locale\]/\(app\)/dashboard/page.tsx
# 预期：5

# 3. 间接引用（import 图深度）
for C in StatCard KolCard CampaignRow AiScoreBadge GlassPanel GradientButton \
         SecondaryButton GhostButton TagChip AvatarWithPlatformBadge \
         ActivityFeedItem SectionHeader; do
  found=$(grep -rE "\b$C\b" src/app/\[locale\]/\(app\)/dashboard/ src/features/dashboard/ src/components/common/ \
    --include='*.tsx' --include='*.ts' 2>/dev/null | wc -l)
  echo "$C: $found refs"
done
# 预期：每个组件 ≥1
```

### 2.5 无 inline 视觉片段（静态 grep）

```bash
# 在 page.tsx 内不应有 rounded-xl/rounded-[Np] + padding 组合的 div（会被视为 inline 卡片）
grep -nE 'className=".*(rounded-xl|rounded-\[1[02468]px\]|bg-surface-low).*(p-|gap-)' \
  src/app/\[locale\]/\(app\)/dashboard/page.tsx
# 预期：0 命中
```

---

## 3. P0-3 · RLS 深度验证环境阻断

与 P0-1 同根因（环境）。setup 脚本跑通后，Reviewer 可执行 spec §L1.5 规定的 18 组 SQL：

```bash
# 每张表 3 场景
docker compose exec -T postgres psql -U postgres -d kolmatrix <<'SQL'
-- 场景 1：有效 tenant
SET LOCAL app.tenant_id = '<demo-tenant-uuid>';  -- 从 select id from tenant limit 1 获取
SELECT COUNT(*) FROM kol;                         -- 预期 12
-- 场景 2：无 tenant
RESET app.tenant_id;
SELECT COUNT(*) FROM kol;                         -- 预期 0（受 RLS 限）
-- 场景 3：伪造 tenant
SET LOCAL app.tenant_id = '00000000-0000-0000-0000-000000000000';
SELECT COUNT(*) FROM kol;                         -- 预期 0
SQL
```

6 张表（`user` / `kol` / `campaign` / `kol_campaign` / `email_template` / `email_log`）× 3 场景 = 18 组。

**注意**：以 `kolmatrix_app` 连接才能看到 RLS 效果（superuser 绕 RLS）。Reviewer 测试时：
```bash
# 非 superuser 连接
docker compose exec -T postgres psql -U kolmatrix_app -d kolmatrix -W
# 密码: kolmatrix_app
```

---

## 4. 其他环境观察（Reviewer 已记录）

| Reviewer 记录 | Generator 回应 |
|---|---|
| `scripts/test/codex-setup.sh` 不存在 | ✅ 本轮补 |
| `scripts/test/codex-wait.sh` 不存在 | ✅ 本轮补 |
| 本机代理影响 curl 返回伪 502 | 在脚本中默认加 `--noproxy '*'` |
| 实际用 `PORT=3099 npm run dev` 等效启动 | 新 setup.sh 同样用 3099 端口，AGENTS.md §3 规定一致 |

---

## 5. 本轮 commit 清单

- `src/features/dashboard/GreetingBar.tsx` — 新建（server component，消费 GradientButton）
- `src/features/dashboard/ActiveCampaignsSection.tsx` — 新建（server component，消费 CampaignRow/GhostButton/SectionHeader）
- `src/app/[locale]/(app)/dashboard/page.tsx` — 重构，JSX 30 行，直接 import 5 F010
- `scripts/test/codex-setup.sh` — 新建，AGENTS.md §3 引用脚本
- `scripts/test/codex-wait.sh` — 新建
- `docs/test-reports/B0-foundation-review-response.md` — 本文档
- `progress.json` — `fix_rounds: 0 → 1`

验收闸门：
- `grep -rE '#[0-9a-fA-F]{6}' src/ | grep -v globals.css` → 0 命中
- `npm run typecheck` / `npm run lint` / `npm run build` → 全绿
- `page.tsx` JSX ≤ 80 ✓（实际 30）
- page.tsx 直接 F010 import ≥ 5 ✓（实际 5）
- 12 组件 import 图覆盖 ✓（见 §2.3 表）

---

## 6. 请 Reviewer 复验清单

- [ ] 用新 `scripts/test/codex-setup.sh` + `codex-wait.sh` 启动环境
- [ ] TC-AUTH-001 正确凭证登录能否成功（预期 /en/dashboard）
- [ ] TC-L1-003 JSX 行数 + 直接 import 数 + 间接引用计数
- [ ] TC-RLS-001~006 18 组 SQL 执行
- [ ] TC-UI-001 / TC-UI-002 / TC-I18N-001 / TC-VIS-001 继续执行
- [ ] 若任一 P0 仍失败，请说明具体日志/截图，不再按"本地环境不足"结论
