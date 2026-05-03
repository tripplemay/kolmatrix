# 本地开发环境搭建

> 目标：fresh clone 后 **30 分钟内**起服务并在浏览器看到 Dashboard。

---

## 1. 先决条件

| 工具 | 版本 | 用途 |
|---|---|---|
| Node.js | **20 LTS**（推荐 20.11+） | Next.js 16 + Prisma 7 runtime |
| npm | ≥10 | 依赖管理（仓库锁定 `package-lock.json`） |
| Docker Desktop | 最新 | PostgreSQL 16 + Redis 7 容器 |
| git | ≥2.30 | Agent 间状态机同步 |

**WSL2 注意事项**：Docker Desktop 需开启 WSL integration；代码放 Linux 文件系统 (`~/code/...`) 比挂载 `/mnt/c` 快 5-10 倍，并避免 Turbopack 文件监听丢失问题。

---

## 2. 克隆 + 安装

```bash
git clone git@github.com:tripplemay/kolmatrix.git
cd kolmatrix
npm ci                  # 锁版本安装
npm run postinstall     # 触发 prisma generate
```

---

## 3. 环境变量

```bash
cp .env.example .env
```

**必须填写**（其他占位在 B2+/B3+ 批次才真正生效）：

| 变量 | 说明 |
|---|---|
| `DATABASE_URL` | 非 superuser 应用连接（走 RLS）。默认值对应 docker-compose 默认端口 5432 |
| `DATABASE_ADMIN_URL` | superuser 连接（migrate + seed 用，绕 RLS） |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` 生成 32 字节 |
| `NEXTAUTH_URL` | 本地为 `http://localhost:3000` |

> **可选**：如果 5432 端口被本机其他 PG 占用，建个 `docker-compose.override.yml`（已在 `.gitignore`）把端口映射到 5433/6380，然后把 `.env` 里的端口同步改为 5433/6380。

---

## 4. 启动 PostgreSQL + Redis

```bash
docker compose up -d
docker compose ps        # 两个服务应为 healthy
```

首次启动会下载 `postgres:16-alpine` 和 `redis:7-alpine` 镜像（约 200MB）。

---

## 5. 数据库 schema + 种子数据

```bash
npx prisma migrate deploy       # 应用全部 3 个 migrations
npm run db:seed                 # 注入 1 tenant / 2 users / 12 KOLs / 3 campaigns / 4 templates / 300 email logs
```

**验证**：

```bash
npx prisma studio               # → http://localhost:5555
```

在 Prisma Studio 看到 12 个 KOL 行、3 个 Campaign 行、300 条 EmailLog 行，则 seed 成功。

---

## 6. 启动 Next.js dev server

```bash
npm run dev
# ✓ Ready in 9.9s — http://localhost:3000
```

---

## 7. 登录 + 看 Dashboard

打开浏览器访问 `http://localhost:3000/login`，输入：

- **Email**：`marketer@kolmatrix.local`
- **Password**：`KOLM@2026!`

登录后自动跳转 `/dashboard`，你会看到 5 个区块：
1. 问候栏（Welcome back, Sarah Chen）+ New Campaign CTA
2. KPI 4 卡（Total KOLs / Active Campaigns / Emails Sent / Avg AI Match 环形进度）
3. Active Campaigns 3 行（Honor of Kings / Genshin Impact / PUBG Mobile）
4. AI-Recommended KOLs 2x2 网格
5. Email Performance 14 天 LineChart + Recent Activity feed

---

## 8. 常见问题

### `prisma migrate deploy` 报 role `kolmatrix_app` 已存在
重复运行同一迁移导致，一般可忽略。想彻底重置：
```bash
docker compose down -v && docker compose up -d
npx prisma migrate deploy && npm run db:seed
```

### Dashboard KPI 卡全为 0
说明 seed 未跑或 session 无 tenant。检查：
```bash
npm run db:seed                              # 重跑
grep marketer .env                            # 确认 marketer 账号在
```

### Turbopack 改代码无热更新（WSL2 挂 /mnt/c）
WSL2 对 Windows NTFS 的 `inotify` 不可靠。解决方案：把仓库迁到 Linux 原生文件系统 (`~/code/kolmatrix`)，或改用 `npm run build && npm run start`。

### 端口 3000 被占
`PORT=3001 npm run dev`

---

## 9. 多 agent 协作（harness-driven）

本项目由 **Kimi (Planner)** + **johnsong (Generator) = Claude CLI** + **Reviewer (Evaluator) = Codex** 协作推进。工作流详见 [harness-rules.md](../../harness-rules.md) 与 [CONTRIBUTING.md](../../CONTRIBUTING.md)。

---

## 9.5 启用 pre-commit hook（推荐）

仓库根 `framework/templates/pre-commit-hook.sh` 是多功能 hook，覆盖：

1. **状态机 JSON 校验**（铁律 #11）：`progress.json` / `features.json` / `backlog.json` 在 commit 前自动 `python3 json.load` 解析，挂钩失败拒提交。
2. **Material Symbols subset 守门**（BL-027-F004 / framework v0.9.7）：当 staged 文件含 icon callsite（`material-symbols-outlined` 或 `scripts/material-symbols-icons-manifest.txt`）时，自动跑 `scripts/regenerate-material-symbols-subset.sh`，若 woff2 字节有变化但未 staged → 拒提交并提示 `git add src/app/fonts/material-symbols-outlined.woff2`。

启用方法（fresh clone 后跑一次）：

```bash
cp framework/templates/pre-commit-hook.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

**Bypass（仅紧急情况）：** `git commit --no-verify` —— 不建议；CI 仍会用反向 case 兜底（`tests/integration/material-symbols-coverage.test.ts` case #7）。

---

## 10. 下一步

- 读 [docs/dev/architecture.md](./architecture.md) 了解架构
- 读 [docs/specs/roadmap.md](../specs/roadmap.md) 了解 sprint 顺序
- 读 [design-draft/design-system.md](../../design-draft/design-system.md) 了解视觉规范
