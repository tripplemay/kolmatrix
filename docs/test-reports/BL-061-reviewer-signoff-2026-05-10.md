# BL-061-apify-fork-totallikes-verify Reviewer Signoff 2026-05-10

> 状态：**PASS**（Codex Reviewer 独立验收完成）
> 触发：BL-061 进入 `verifying`，验收 fork totalLikes/postsCount 修复、KOLMatrix engagement_rate 落库、UI 透明度 tooltip、prod 数据恢复与 BL-058 P0 关闭。

---

## 结论

BL-061 5/5 features 验收通过，允许 `progress.json.status` 从 `verifying` 置为 `done`。

关键结论：
- apify-kol service：HEAD=`1374473`，`/health={"status":"ok"}`。
- KOLMatrix mapper：`src/lib/kol-sync/adapters/apify-kol.ts` engagement_rate 公式未改，仍为 `(totalLikes / postsCount) / followers * 100`。
- staging 数据：1231 total / 83 non-null / 6.7%，满足 amendment 后 `>=5%`。
- prod 数据：1231 total / 82 non-null / 6.7%，满足 amendment 后 `>=5%`。
- F004 tooltip：本地与 staging 均验证 `/discovery` + `/kols/:id` 渲染；5 语言 title 文案匹配。
- BL-058 P0 sub-feature：Generator 已关闭为 `closed-bl-061-verified`，Reviewer 认可该关闭依据。

## L1 本地验证

| 项 | 结果 |
|---|---|
| `npm run lint` | PASS，0 errors / 2 warnings（既有 unused vars） |
| `npm run typecheck` | PASS |
| `npm test` | PASS，157 files / 1103 tests |
| `bash scripts/test/codex-setup.sh` + `codex-wait.sh` | PASS，Next ready at `http://localhost:3099/login` |
| Login smoke | PASS（重启本地测试服务并设置 `DISABLE_LOGIN_RATELIMIT=true` 后单点登录通过） |
| F004 local UI probe | PASS，`/en/discovery` 12 tooltip，`/en/kols/:id` 1 tooltip，英文 title 匹配 |
| F004 local i18n probe | PASS，`en/zh/ja/ko/es` 5 语言 `/discovery` tooltip title 全匹配 |

完整 E2E suite 首次运行结果：27 failed / 27 passed / 29 skipped。失败根因是并发重复登录触发本地登录限流，失败截图显示 `Too many attempts. Retry after 32s`，后续单点登录在禁用本地限流后 PASS。该问题按 suite isolation/测试环境干扰记录，不作为 BL-061 产品失败。

## L2 实测记录

| 项 | 证据 |
|---|---|
| Staging health | token-auth `/api/health`：`status=healthy`，`git_sha=e810c8e`，DB ok 35ms，Redis ok 5ms |
| Prod health | token-auth `/api/health`：`status=healthy`，`git_sha=b618d5d`，DB ok 34ms，Redis ok 7ms |
| Runtime SHA 差异 | `e810c8e..HEAD` 与 `b618d5d..HEAD` 均只含 docs/spec/report/state/backlog，无 runtime 路径，按 evaluator SHA 容许规则不阻断 |
| apify-kol service | SSH 只读：`/opt/apify-kol-service` HEAD=`1374473`，`http://localhost:3003/health={"status":"ok"}` |
| Staging SQL total | `total=1231 / non_null=83 / pct=6.7` |
| Staging SQL platform | IG `37/0/0.0%`，TT `818/11/1.3%`，YT `376/72/19.1%` |
| Staging handle spot check | IG `ninja=NULL`，TT `gaming=0.75`，YT `UC6QZ...=18.83` |
| Prod SQL total | `total=1231 / non_null=82 / pct=6.7` |
| Prod SQL platform | IG `37/0/0.0%`，TT `818/11/1.3%`，YT `376/71/18.9%` |
| Prod handle spot check | IG `ninja=NULL`，TT `gaming=0.75`，YT `UC6QZ...=18.83` |
| Staging UI tooltip | `/discovery` 5 locale 各 20 tooltip，title 全匹配；`/en/kols/:id` 1 tooltip，英文 title 匹配 |

Prod authenticated UI tooltip 未做浏览器登录验证：prod 密码已轮换且不在项目记忆中；Reviewer 未尝试默认密码以避免触发生产登录限流。Prod runtime SHA=`b618d5d` 已包含 F004 runtime 代码，且 staging 同代码路径 UI 实测通过。

## Ops 副作用记录

Reviewer 本轮无写库、无 deploy、无 sync 触发。所有 SSH/SQL 均为只读：
- `curl /api/health`
- `git rev-parse`
- `SELECT` from `kol`
- apify service `/health`

## Soft-watch

| ID | 描述 | 风险等级 | 建议处置 |
|---|---|---|---|
| S1 | engagement_rate non-null 仅 6.7%，本批按 user choice C 调整阈值至 5%；80%/95% 目标未达 | medium | BL-062 数据 coverage 治理，5/17 起每周重跑 growth-curve SQL |
| S2 | 完整 E2E suite 并发登录会触发本地登录限流，导致非本批页面大面积 timeout | medium | BL-054-flaky 或独立 E2E infra 批次：扩大 storageState opt-in，减少逐 case 登录 |
| S3 | Prod authenticated UI 未登录实测，因生产密码不在仓库记忆中 | low | 用户如需生产 UI 截图验收，可提供临时测试账号或由 Planner 安排人工手验 |

## Framework Learnings

本批次无新增 framework learning。E2E 登录限流问题已在 evaluator role-context 中有 suite-level isolation 经验，后续归 BL-054-flaky 处理即可。
