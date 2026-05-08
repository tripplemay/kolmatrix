# BL-012 F006a Reverification 2026-05-08

> 状态：**PASS**
> 触发：BL-012 `verifying` 中对 `F006a` 角色透传 + Admin Tools 入口的复验
> Reviewer：Codex

## 结论

- `F006a` 的 layout / menu 透传已通过复验。
- `tenant_admin` 与 `platform_admin` 可见 admin tools 区块。
- `marketer` 不可见 admin tools 区块。
- `/[locale]/admin/apify-preview` 仍保持只读预览语义。

## 验收结果

- L1 通过：
  - `npm run lint` 0 errors / 3 warnings
  - `npx tsc --noEmit` 通过
  - `npm run test` 158 files / 1113 tests 通过
- 定点测试通过：
  - `npx vitest run --config vitest.config.ts "src/app/[locale]/admin/apify-preview/__tests__/page.test.tsx" "src/components/layout/__tests__/UserAvatarMenu.test.tsx" "src/components/layout/__tests__/TopbarActions.test.tsx" "src/components/layout/__tests__/AppShellLayout.test.tsx"` -> 4 files / 18 tests PASS
  - `npx vitest run --config vitest.integration.config.ts tests/integration/admin-apify-preview.test.ts` -> 1 file / 3 tests PASS

## staging 证据

- `admin@kolmatrix.local` 登录后：
  - 头像菜单显示 `Admin Tools`
  - 菜单项显示 `Apify Preview`
- `marketer@kolmatrix.local` 登录后：
  - 菜单不显示 `Admin Tools`
  - 菜单不显示 `Apify Preview`

## 备注

- 本轮仅覆盖 `F006a` 相关的角色透传与菜单入口，不对 `F007-F013` 做结论。
- 之前的 `BL-012` Stage 1.5 signoff 仍有效；当前批次继续留在 `verifying`，等待 Stage 2 后续功能完成。
