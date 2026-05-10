# 反馈爬虫团队 — fork master Dockerfile 与 docker-compose 不同步（2026-05-10）

> 来源：KOLMatrix Planner / BL-061 F001 fork-sync deploy 实战发现
> 触发：BL-061 5/10 13:30 KOLMatrix 团队从 fork master `1374473` 同步到 `/opt/apify-kol-service` 时 docker compose up --build 失败
> 收件方：fork `apify-kol-service` 维护团队（`guang-tech/apify`）
> 用途：复制粘贴用 — §1 GitHub Issue 完整版（推荐发到 fork 仓库 issues），§2 Slack/微信简短版（紧急通报）

---

## §1 GitHub Issue 完整版（fork 仓库 issues）

### Title

`[infra/repo-hygiene] fork master Dockerfile 与 monorepo 5/9 重构不同步 + docker-compose ports 错配 → 下游 fork-sync deploy 必失败`

### Body

```markdown
## 背景

KOLMatrix 团队 5/10 13:30 按既有 runbook（`docs/dev/kol-sync-runbook.md` §"apify-kol-service fork 同步流程"）从 fork master 同步 totalLikes 修复（决策文档：`guang-tech/apify @ master @ docs/decisions/2026-05-09-totallikes-postscount-estimation.md`）到本机 `/opt/apify-kol-service`。同步过程中 `docker compose up -d --build` 两处失败，需 KOLMatrix 端 awk + sed hot-fix 才能跑起来。两处都是 fork master 自身 repo 不一致问题，**不是 KOLMatrix 端 sed workaround 失效**。

本 issue 列出两个 fork 上游 bug + 实测复现，希望爬虫团队修后 KOLMatrix 端可去 hot-fix。

## Bug 1: `packages/service/Dockerfile` 没 COPY 新 `@apify-kol/apify` workspace 包

### 实测错误

`docker compose up -d --build` 在 builder stage 报：

```
ERR_PNPM_WORKSPACE_PKG_NOT_FOUND In packages/service:
  "@apify-kol/apify@workspace:*" is in the dependencies
  but no package named "@apify-kol/apify" is present in the workspace
```

### 根因

5/9 commit `7e72cc8 feat(apify+service): YT business email via Apify actor 解锁链路` 引入新 workspace 包 `packages/apify/`（YT business email actor SDK），并把 `@apify-kol/apify@workspace:*` 加到 `packages/service/package.json` 的 dependencies。

但 `packages/service/Dockerfile` 没同步 COPY 这个新 package — builder stage 仅 COPY `packages/sdk` + `packages/service`，runtime stage 同样缺 `packages/apify` 的 dist。pnpm install 时找不到该 workspace package，build fail。

### 期望的修复（5 处插入）

`packages/service/Dockerfile`（builder + runtime 两 stage 共 5 行 insert）：

```diff
 # ===== builder stage =====
 COPY packages/sdk/package.json packages/sdk/
 COPY packages/service/package.json packages/service/
+COPY packages/apify/package.json packages/apify/
 RUN pnpm install --frozen-lockfile
 COPY packages/sdk packages/sdk
 COPY packages/service packages/service
+COPY packages/apify packages/apify
 RUN pnpm --filter @apify-kol/sdk build
+RUN pnpm --filter @apify-kol/apify build
 RUN pnpm --filter @apify-kol/service build

 # ===== runtime stage =====
 COPY --from=builder /app/packages/service/dist packages/service/dist
 COPY --from=builder /app/packages/service/src/db/migrations packages/service/dist/db/migrations
+COPY --from=builder /app/packages/apify/package.json packages/apify/
+COPY --from=builder /app/packages/apify/dist packages/apify/dist
 RUN pnpm install --frozen-lockfile --prod
```

KOLMatrix 端**当前用 awk hot-fix 临时 patch 这 5 处**才能跑起来。fork 端修复后 KOLMatrix 端可去 awk hot-fix。

## Bug 2: `docker-compose.yml` ports 默认 `3003:3000` 与 service 监听端口不一致

### 实测错误

修复 Bug 1 后 docker compose up 成功，service 容器显 `running 9 seconds`，但 host 端 `curl http://localhost:3003/health` 返回 `Connection reset by peer`。

### 根因

`packages/service` 5/9 把 service 监听端口默认改为 `3003`（应该是配合 `SERVICE_PORT` 环境变量或某 config 默认）。Service 容器内 stdout 显示 `Server listening at http://0.0.0.0:3003`。

但 `docker-compose.yml` 端口映射仍是 `"3003:3000"`（host 3003 → container 3000）— host 流量打到 container 的 3000 端口，service 不在那个端口，所以连接重置。

### 期望的修复

二选一：

**A 方案（推荐）：** `docker-compose.yml` ports 改为 `"3003:3003"`，对齐 service 实际监听端口

```diff
 service:
   ports:
-    - "3003:3000"
+    - "3003:3003"
```

**B 方案：** `packages/service` 服务端默认 `SERVICE_PORT=3000` 不变，docker-compose 不改。但这要求 service 端代码改回。

KOLMatrix 端**当前用第三个 sed workaround `3003:3000 → 3003:3003`** 临时 patch。fork 修复后可去。

## 复现路径（任何下游集成方）

```bash
git clone https://github.com/guang-tech/apify.git apify-kol-service
cd apify-kol-service
docker compose up -d --build
# Bug 1: pnpm install 在 builder stage fail
# 即使手动 patch Dockerfile 加 COPY apify package
docker compose up -d --build
curl http://localhost:3003/health
# Bug 2: Connection reset by peer
```

## 影响

KOLMatrix 团队每次 fork-sync 必须维护 4 个 sed/awk hot-fix（runbook §2 已 2 项 + 本 issue 触发新增 2 项）：

1. `sed packages/service/Dockerfile` path 取代 root（fork 已 monorepo）— 已有
2. `sed pnpm install --no-frozen-lockfile`（lockfile drift） — 已有
3. **新（Bug 2）**: `sed docker-compose.yml ports 3003:3000 → 3003:3003`
4. **新（Bug 1）**: `awk 5 行 insert Dockerfile` 加 `@apify-kol/apify` package COPY + build

每次 fork 推大版本都需要 KOLMatrix 端检查上游是否修了这两处 bug。**理想状态：fork 上游修复后 KOLMatrix 端 sed 清单回到 2 项**。

## 关联

- KOLMatrix 5/10 fork-sync 实战 audit trail：commits `8423df6 → 71d5e92 → bc8dbfd`（详 `.auto-memory/environment.md` apify-kol service 段 + `docs/dev/kol-sync-runbook.md` §2 升级版 sed 清单）
- 决策文档（已 push 上游）：`docs/decisions/2026-05-09-totallikes-postscount-estimation.md` §9 上线待办
- KOLMatrix BL-061 spec §3：F001 fork-sync deploy by Planner ops 实战记录

## 优先级

**P2** — 阻断 fork-sync 流畅度但不阻断 KOLMatrix 业务（KOLMatrix 端已 hot-fix；BL-061 已 done）。建议 fork 端在下次大版本前修复，避免后续 KOLMatrix sync 重复踩坑。
```

---

## §2 Slack / 微信简短版（紧急通报，附 Issue link）

```
@爬虫团队负责人 P2 ⚠️

KOLMatrix 5/10 从 fork master 1374473 同步 totalLikes 修复时发现 fork 自身 2 处 bug：

1. packages/service/Dockerfile 没 COPY 新 @apify-kol/apify workspace 包（5/9 commit 7e72cc8 加包但 Dockerfile 没同步）→ docker compose up --build 在 builder 阶段 ERR_PNPM_WORKSPACE_PKG_NOT_FOUND
2. docker-compose.yml ports 默认 3003:3000 但 service 实际监听 3003 → curl http://localhost:3003/health Connection reset

当前 KOLMatrix 端 awk 5 行 hot-fix Dockerfile + sed 第三个 workaround 临时跑通。理想 fork 上游修复后 KOLMatrix sed 清单可回到 2 项。

详细 issue: [fork repo issue link]
```

---

## 操作建议

1. **先发 Slack 通报** — 让爬虫团队知道两处 fork 上游 bug
2. **然后开 GitHub Issue（§1）** — 留 audit trail，含 diff 建议方便他们直接 PR
3. **跟踪：** Issue 关闭 + fork PR merge 后 KOLMatrix 端下次 sync 可去 awk hot-fix + 第三个 sed
4. **回报：** 收到 fork 修复 commit/PR link 后，更新 `.auto-memory/environment.md` apify-kol service 段（删除 awk hot-fix 描述）+ `docs/dev/kol-sync-runbook.md` §2 sed 清单回到 2 项

---

## 文档维护

- 此文件存在 `docs/inbox/`（未提交主流程功能，仅作沟通底稿）
- 当 fork 修复完成后，可移到 `docs/archive/` 或直接删除
- 历史参照：`docs/inbox/feedback-fork-totallikes-2026-05-09.md`（5/9 fork 字段缺失反馈，已闭环）
