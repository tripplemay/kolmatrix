# BL-012 apify-kol-integration Signoff 2026-05-08

> 状态：**Reviewer signoff PASS**
> 触发：BL-012 `reverifying` 完成 fix-round 1 + F006a + fix-round 2 的综合复验
> Reviewer：Codex

## 总体结论

- BL-012 Stage 1.5 + F006a 已完成签收，结论为 `Ready`。
- 关键 blocker 已闭合：
  - `/[locale]/admin/apify-preview` 允许真实种子管理员 `tenant_admin`
  - `marketer` 仍被正确重定向回 dashboard
  - `UserAvatarMenu` 对 admin role 透传正确，管理员头像菜单出现 `Admin Tools / Apify Preview`
  - fix-round 2 后 preview 页可用真实 prod 数据渲染，不再因 `externalUrls` / `aggregatorLinks` 形状触发 zod 解析失败
  - preview 页保持 read-only，没有数据流回写 main DB 的迹象

## 验收结果

- L1 通过：
  - `npm run lint` 0 errors / 3 warnings
  - `npx tsc --noEmit` 通过
- BL-012 相关测试通过：
  - `npx vitest run --config vitest.config.ts "src/lib/admin/__tests__/apify-preview-client.test.ts" "src/app/[locale]/admin/apify-preview/__tests__/page.test.tsx" "src/components/layout/__tests__/UserAvatarMenu.test.tsx" "src/components/layout/__tests__/TopbarActions.test.tsx" "src/components/layout/__tests__/AppShellLayout.test.tsx"` -> 5 files / 25 tests PASS
  - `npx vitest run --config vitest.integration.config.ts tests/integration/admin-apify-preview.test.ts` -> 1 file / 3 tests PASS
- 全量回归通过：
  - `npm run test` -> 158 files / 1113 tests PASS
- Staging smoke 通过：
  - `admin@kolmatrix.local` 登录后可进入 `/en/admin/apify-preview`
  - 页面标题为 `Apify-KOL Preview (READ-ONLY)`
  - 只读 banner 可见
  - `Admin Tools` 菜单项对 `tenant_admin` 可见，对 `marketer` 不可见
  - `marketer@kolmatrix.local` 访问同页会被重定向回 `/en/dashboard`
  - prod `https://kol.guangai.ai/en/admin/apify-preview` 以真实数据渲染成功，`tableRows = 50`，无 fetch-error banner

## 关键证据

### 1. 角色门已对齐真实角色枚举

- `src/app/[locale]/admin/apify-preview/page.tsx` 已改为放行 `platform_admin` 与 `tenant_admin`。
- `src/app/[locale]/admin/apify-preview/__tests__/page.test.tsx` 已补齐：
  - `tenant_admin` 通过
  - `platform_admin` 通过
  - 旧的字面量 `admin` 被拒绝
  - `marketer` 仍被拒绝

### 2. F006a 侧边栏入口已通过

- `src/lib/auth/roles.ts` 抽出 `isAdminRole(role)` helper，统一判定 `platform_admin` / `tenant_admin`。
- `src/components/layout/UserAvatarMenu.tsx` 已透传 role，并在 admin menu 中显示：
  - `Admin Tools`
  - `Apify Preview`
- `src/components/layout/__tests__/UserAvatarMenu.test.tsx` 覆盖：
  - `tenant_admin` 可见 admin section
  - `platform_admin` 可见 admin section
  - `marketer` 不可见
  - `undefined` 不可见

### 3. fix-round 2 zod union schema 已通过

- `src/lib/admin/apify-preview-client.ts` 将 schema 宽化为：
  - `externalUrls: string | { url, title? }[]`
  - `aggregatorLinks: record | array | null`
- `src/lib/admin/__tests__/apify-preview-client.test.ts` 新增两条回归用例：
  - `externalUrls` 接受 `{url, title}` 对象数组
  - `aggregatorLinks` 接受数组或 record

### 4. 数据流隔离保持

- `tests/integration/admin-apify-preview.test.ts` 继续证明：
  - preview client 只走 fork API
  - `src/lib/admin` 不导入 `@/lib/kol-sync/*`
  - `src/lib/admin` 不直接写 `prisma.kol.*`

### 5. 运行时核对

- 角色门修复后，staging 上 `tenant_admin` 能看到只读预览页，不再被踢回 dashboard。
- `marketer` 仍然被正确挡回 dashboard，符合可见性约束。
- prod 上 `/en/admin/apify-preview` 现在可正常加载真实数据，页面展示 50 行样本并计算 4 维度门控结果。

## 说明

- 本次 signoff 聚焦 BL-012 Stage 1.5 的 preview 页、F006a admin menu、fix-round 2 的 zod schema 兼容性、权限门、只读展示和数据流隔离。
- `prod` 样本的 4 维度门控结果当前为 `1 / 4 passed`，这是数据质量观察，不是技术阻断。
- 早前出现的 `material-symbols-coverage` 外部网络 flake 不属于本批阻断项，不作为本次签收门槛。

## 最终结论

- Final grade: `A-`
- Readiness: `Ready`
- `progress.json.docs.signoff` 已填入本报告路径。
