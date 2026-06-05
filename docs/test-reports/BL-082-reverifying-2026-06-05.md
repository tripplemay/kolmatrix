# BL-082 Reverifying 2026-06-05

> 状态：`reverifying` 进行中
> 范围：BL-082 `F007` fix-round 1 后复验

---

## 结论

- 当前结论：**PARTIAL**
- fix-round 1 已解决上轮 L1 阻断
- staging 复验通过
- 但 prod 仍未部署 BL-082 代码，acceptance 中的 prod 只读核验项尚无法完成

---

## 本轮复验范围

针对上一轮唯一阻断点复验：

- `tests/unit/kol-sync-daily.test.ts` 两个 BL-082 refresh-phase case

并补做：

- 全量 L1
- staging 关键路径 spot-check
- prod 部署状态只读确认

---

## L1 复验结果

环境前置：

- `.nvmrc` = `20`
- 本机默认 `node -v` = `v25.7.0`
- 已切换到 `node v20.20.2`

专项复验：

- `npx vitest run tests/unit/kol-sync-daily.test.ts` PASS
  - `12 passed`

全量 L1：

- `npx prisma generate` PASS
- `npx prisma validate` PASS
- `npx tsc --noEmit` PASS
- `npm run lint` PASS（`0 errors, 3 warnings`，均为既有 unused warning）
- `npm test` PASS（`194 files, 1423 tests`）
- `bash scripts/validate-rollback-sql.sh` PASS（`36 migration(s)`）

结论：

- 上一轮 L1 阻断已消失
- Generator 关于“测试夹具 date-dependent flaky 已修复”的 handoff 与实测一致

---

## Staging 复验结果

健康检查：

- `https://staging.kol.guangai.ai/api/health` → `healthy`

已有生成侧旁证（F006）：

- `platform_user_id` backfill staged `1859`
- refresh phase 实测 `totalRefreshed=253`
- per-platform:
  - `youtube=91`
  - `tiktok=127`
  - `instagram=35`
- `404 rate = 0%`

本轮 Reviewer spot-check：

- Playwright `marketer.setup` PASS
- Playwright `/match` 两条用例 PASS
  - `card view mounts the grid + at least one KOL card`
  - `filter sidebar exposes status pills`

结论：

- staging L2 未见 BL-082 引入的回归
- refresh phase 相关运行证据与 handoff 一致

---

## Prod 只读状态

SSH 只读确认：

- prod host `/opt/kolmatrix` 当前 SHA：`6788225`
- 本地 `main` 当前 SHA：`0d353bd`

说明：

- prod 目前仍停留在 BL-081 后的版本
- 还没有部署 BL-082 的 refresh-selector rewire / platform_user_id 相关改动

因此 acceptance 中这条当前无法完成：

- `Prod 只读核验: 部署+回填后 next-24h 监控 refreshCount 非 0 + 404 比例 ≤5%`

这不是新的代码失败，而是部署前置未满足。

---

## Reviewer 结论

本轮 `reverifying` 可以确认：

1. fix-round 1 已修掉上轮 L1 阻断
2. staging 证据成立
3. 当前唯一剩余阻塞是 **prod 尚未部署 BL-082**

在 prod deploy 完成前：

- 不能写 signoff
- `progress.json.docs.signoff` 不能填写
- 不应切 `done`
