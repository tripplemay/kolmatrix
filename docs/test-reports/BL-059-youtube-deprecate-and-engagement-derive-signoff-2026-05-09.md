# BL-059 youtube-deprecate-and-engagement-derive Signoff 2026-05-09

> 状态：**Reviewer signoff PASS**
> 触发：BL-059 `verifying` 完成最终复验
> Reviewer：Codex

## 总体结论

- BL-059 已完成签收，结论为 `Ready`。
- KOLMatrix 的 KOL 数据源已从双源切换为单源 `apify-kol`：
  - `scripts/kol-sync-daily.ts` 仅注入 `ApifyKolSyncAdapter`
  - `src/lib/kol-sync/adapters/youtube.ts`、`engagement-batch.ts`、`engagement-batch-client.ts`、`published-after.ts` 已移除
  - `src/lib/kol-sync/quality.ts`、`refresh-selector.ts`、`dispatcher.ts` 已同步清理 YouTube 依赖
- `apify-kol` mapper 已补上 `engagement_rate` derive 计算，F002/F003 迁移与软删除路径已闭合。

## 验收结果

- L1 通过：
  - `npm run lint` 0 errors / 2 warnings
  - `npx tsc --noEmit` 通过
  - `npm run test` 156 files / 1101 tests PASS
- 定点测试通过：
  - `npx vitest run --config vitest.config.ts tests/unit/apify-kol-adapter.test.ts tests/unit/kol-sync-daily.test.ts tests/unit/kol-sync-quality.test.ts` -> 3 files / 43 tests PASS
  - `npx vitest run --config vitest.integration.config.ts tests/integration/apify-kol-adapter.test.ts tests/integration/admin-apify-preview.test.ts` -> 2 files / 8 tests PASS
- Staging smoke 通过：
  - `https://staging.kol.guangai.ai/api/health` -> `status: healthy`, DB ok, Redis ok
  - `/en/dashboard`、`/en/discovery`、`/en/database` 页面均可正常加载

## 关键证据

### 1. 单源切换已落地

- `src/lib/kol-sync/adapters/apify-kol.ts` 已包含 `discover()`、`refresh()`、`healthCheck()` 以及错误分类。
- `src/lib/kol-sync/adapters/youtube.ts` 已删除，旧的 YouTube daily chain 不再参与日常 sync。
- `scripts/kol-sync-daily.ts` 的 dry-run 与 env gate 已改成 `apify-kol` 单源逻辑。

### 2. engagement_rate derive 与数据修复已通过

- `src/lib/kol-sync/adapters/apify-kol.ts` 在 mapper 内计算 `engagement_rate`。
- `src/lib/apify-kol/schemas.ts` 被 preview client 与 adapter 共享消费。
- F002/F003 相关 SQL 与软删除路径已在 staging / full test 中验证通过。

### 3. 运行时与 staging 核对

- staging 登录态下公开页可正常访问。
- `marketer` 账号仍按预期受限，不影响公开页 smoke。
- `npm run kol-sync:daily:dry` 的本地缺少 `APIFY_KOL_BASE_URL` / `APIFY_KOL_BUSINESS_API_KEY` 和 `/var/log` 写权限，仅为本机环境限制，不是代码回归。

## 说明

- 本次 signoff 覆盖 BL-059 的最终复验范围：F001-F007。
- 当前代码库已经不再保留 YouTube daily 作为 KOL 日常同步来源。
- `apify-kol` 单源 + `engagement_rate` derive 的链路已可作为后续 prod redeploy 后的 cron 基础。

## 最终结论

- Final grade: `A-`
- Readiness: `Ready`
- `progress.json.docs.signoff` 已填入本报告路径。
