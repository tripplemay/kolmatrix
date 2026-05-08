# BL-012 apify-kol-integration Signoff 2026-05-08

> 状态：**Reviewer signoff PASS**
> 触发：BL-012 `reverifying` 完成 fix-round 1 后的最终复验
> Reviewer：Codex

## 总体结论

- BL-012 Stage 1.5 已完成签收，结论为 `Ready`。
- 关键 blocker 已闭合：
  - `/[locale]/admin/apify-preview` 允许真实种子管理员 `tenant_admin`
  - `marketer` 仍被正确重定向回 dashboard
  - preview 页保持 read-only，没有数据流回写 main DB 的迹象

## 验收结果

- L1 通过：
  - `npm run lint` 0 errors / 3 warnings
  - `npx tsc --noEmit` 通过
- BL-012 相关测试通过：
  - `npx vitest run --config vitest.config.ts "src/app/[locale]/admin/apify-preview/__tests__/page.test.tsx" "src/app/[locale]/admin/apify-preview/__tests__/StatsCards.test.tsx" "src/app/[locale]/admin/apify-preview/__tests__/PreviewTable.test.tsx" "src/lib/admin/__tests__/apify-preview-client.test.ts"` -> 4 files / 20 tests PASS
  - `npx vitest run --config vitest.integration.config.ts tests/integration/admin-apify-preview.test.ts` -> 1 file / 3 tests PASS
- Staging smoke 通过：
  - `admin@kolmatrix.local` 登录后可进入 `/en/admin/apify-preview`
  - 页面标题为 `Apify-KOL Preview (READ-ONLY)`
  - 只读 banner 可见
  - `marketer@kolmatrix.local` 访问同页会被重定向回 `/en/dashboard`

## 关键证据

### 1. 角色门已对齐真实角色枚举

- `src/app/[locale]/admin/apify-preview/page.tsx` 已改为放行 `platform_admin` 与 `tenant_admin`。
- `src/app/[locale]/admin/apify-preview/__tests__/page.test.tsx` 已补齐：
  - `tenant_admin` 通过
  - `platform_admin` 通过
  - 旧的字面量 `admin` 被拒绝
  - `marketer` 仍被拒绝

### 2. 数据流隔离保持

- `tests/integration/admin-apify-preview.test.ts` 继续证明：
  - preview client 只走 fork API
  - `src/lib/admin` 不导入 `@/lib/kol-sync/*`
  - `src/lib/admin` 不直接写 `prisma.kol.*`

### 3. 运行时核对

- 角色门修复后，staging 上 `tenant_admin` 能看到只读预览页，不再被踢回 dashboard。
- `marketer` 仍然被正确挡回 dashboard，符合可见性约束。

## 说明

- 本次 signoff 聚焦 BL-012 Stage 1.5 的 preview 页、权限门、只读展示和数据流隔离。
- 早前出现的 `material-symbols-coverage` 外部网络 flake 不属于本批阻断项，不作为本次签收门槛。

## 最终结论

- Final grade: `A-`
- Readiness: `Ready`
- `progress.json.docs.signoff` 已填入本报告路径。
