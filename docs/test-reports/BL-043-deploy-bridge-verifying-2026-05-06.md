# BL-043 deploy-staging.yml + .env.staging Bridge 验证报告 2026-05-06

> 状态：**Reviewer verification complete**
> 触发：BL-043 `deploy-staging.yml + .env.staging Bridge 闭合`
> Reviewer：Codex

## Summary

- Scope: 验证 BL-043 的 3 个 feature：`deploy-{staging,prod}.sh` 对 `KOLMATRIX_APP_PASSWORD` 的 fail-fast 守门、`.auto-memory/environment.md` 的 staging Postgres 密码同步协议文档化、staging deploy smoke test 的 standard path + fail-fast path。
- Documents: [`docs/specs/BL-043-deploy-staging-yml-bridge-spec.md`](/Users/yixingzhou/project/joyce/docs/specs/BL-043-deploy-staging-yml-bridge-spec.md), [`infrastructure/deploy-staging.sh`](/Users/yixingzhou/project/joyce/infrastructure/deploy-staging.sh), [`scripts/deploy-prod.sh`](/Users/yixingzhou/project/joyce/scripts/deploy-prod.sh), [`.auto-memory/environment.md`](/Users/yixingzhou/project/joyce/.auto-memory/environment.md), [`progress.json`](/Users/yixingzhou/project/joyce/progress.json)
- Environment: 本地 L1 (`npm run lint`, `npm run typecheck`, `bash -n`, `npm test`) + staging `https://staging.kol.guangai.ai`
- Result totals: PASS 3, FAIL 0, BLOCKED 0, NOT RUN 0

## Test Cases

- BL-043-TC-01 L1 guardrails and repo sanity - PASS
- BL-043-TC-02 Staging fail-fast path when `KOLMATRIX_APP_PASSWORD` is unset - PASS
- BL-043-TC-03 Staging standard deploy path and health alignment - PASS

## Execution Results

### BL-043-TC-01 L1 guardrails and repo sanity

Result: PASS
Evidence:
- `npm run lint` -> PASS with 3 pre-existing warnings only
- `npm run typecheck` -> PASS
- `bash -n infrastructure/deploy-staging.sh && bash -n scripts/deploy-prod.sh` -> PASS
- `npm test` -> one unrelated existing failure in `src/app/[locale]/(app)/campaigns/[id]/__tests__/AiSuggestionsClient.test.tsx`
Observed Behavior:
- BL-043 touches only shell scripts and documentation. Syntax, lint, and typecheck stayed green.
Mismatch vs Spec:
- None for BL-043 scope.
Defect Link / Reference:
- Existing unrelated failure: `window.localStorage.setItem is not a function` / `window.localStorage.clear is not a function` in `AiSuggestionsClient.test.tsx`

### BL-043-TC-02 Staging fail-fast path

Result: PASS
Evidence:
- On staging host, ran `./infrastructure/deploy-staging.sh` with `KOLMATRIX_APP_PASSWORD` unset
- Script completed the normal prelude (`git pull`, `npm ci`, `prisma generate`, `prisma migrate deploy`)
- Script then printed `❌ FATAL: KOLMATRIX_APP_PASSWORD is unset`
- Exit code was `1`
Observed Behavior:
- The deploy no longer silently skips password rotation. Missing `KOLMATRIX_APP_PASSWORD` now stops the deploy with an explicit error and remediation hint.
Mismatch vs Spec:
- None
Defect Link / Reference:
- None

### BL-043-TC-03 Staging standard deploy path

Result: PASS
Evidence:
- Re-ran `./infrastructure/deploy-staging.sh` on staging with `.env.staging` sourced normally
- `git pull --ff-only origin main` reported `Already up to date.` with `HEAD=ce87a57`
- `ALTER ROLE` password rotation executed successfully
- `next build` completed successfully
- `pm2 restart kolmatrix-staging --update-env` succeeded
- Health check returned `status=healthy`, `database=ok`, `redis=ok`, `git_sha=ce87a57`
- Final deploy log ended with `✅ staging deploy done (HEAD=ce87a57, health.git_sha=ce87a57)`
Observed Behavior:
- Standard deploy path still works after the fail-fast guard was introduced, and the deployed `git_sha` matches the repo HEAD used for the run.
Mismatch vs Spec:
- None
Defect Link / Reference:
- None

## Defects

- None in BL-043 scope.

## Coverage Gaps

- The unrelated `AiSuggestionsClient.test.tsx` failure still exists in the broader suite. It is not caused by BL-043, but it means the repository-wide `npm test` command is not fully green.

## Open Questions

- Should the unrelated `AiSuggestionsClient.test.tsx` issue be handled as a separate fix round before any broader release gate that requires a fully green repository test suite?

## Final Decision

- Ready: Yes for BL-043 scope
- Readiness: Verified
- Final: `PASS`
