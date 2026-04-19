# B0 Foundation 测试计划（待启动）

## 1. 目标与范围
- 批次：`B0-foundation`
- 目标：在开发完成后，对 B0 规格（F001-F010）执行结构化验收，输出可追溯证据与结论。
- 本文状态：已准备，**未执行测试**。

## 2. 入口条件（全部满足才启动）
- `progress.json.status` 从 `building` 进入 `verifying` 或收到你明确“开始测试”指令。
- Generator 已声明本批次开发完成并可验收（含必要 handoff）。
- 本地环境可用：`localhost:3099` 可访问，数据库与 seed 数据就绪。
- 关键账号可登录：`marketer@kolmatrix.local` / `admin@kolmatrix.local`。

## 3. 环境与边界
- L1 本地验收：`http://localhost:3099`
- L2 Staging/生产相关：仅在你授权后执行。
- 安全边界：遵守 `PRODUCTION_DB_WRITE=DENY`、`HIGH_COST_OPS=DENY`，不做高风险写操作。

## 4. 测试分层与顺序
1. Smoke：服务可启动、核心路由可访问、登录链路基本可用。
2. L1 自动化与静态检查：build/tsc/lint、HEX 扫描、组件复用与结构约束。
3. L1.5 手工深度：RLS 18 组查询（6 表 x 3 场景）、Auth 全流程、关键功能行为核验。
4. L2 视觉回归：Dashboard 与 Stitch 基线并排/差异图比对（授权后执行）。
5. L3 E2E checklist：关键用户流程闭环。
6. L4 文档与 DX：README 可复现、环境变量一致性、组件注释完整性。

## 5. 测试通过门槛（Signoff Gate）
- P0/P1 用例全部 PASS。
- 无 FAIL；PARTIAL 必须为 0（本批次按严格验收）。
- 视觉还原满足：间距偏差 <= 2px，颜色偏差 `ΔE < 2`，字号 100% 匹配。
- 证据完备：命令输出、SQL 结果、截图与 diff 图齐全。

## 6. 产出物与落盘路径
- 用例清单：`docs/test-cases/B0-foundation-test-cases.md`
- 执行记录：`docs/test-reports/B0-foundation-execution-YYYY-MM-DD.md`
- 最终签收：`docs/test-reports/B0-foundation-signoff-YYYY-MM-DD.md`
- 截图建议目录：`docs/test-reports/artifacts/B0-foundation/`

## 7. 风险与应对
- 风险：本地端口冲突/依赖漂移导致假失败。
  - 应对：先跑 smoke，再执行正式用例；记录环境快照（node/npm/数据库端口）。
- 风险：视觉比对工具口径不一致。
  - 应对：固定视口（1280x2048）+ 保留 actual/baseline/diff 三件套。
- 风险：RLS 校验遗漏。
  - 应对：按用例强制覆盖 6 张多租户表，不得抽样。

## 8. 启动后执行节奏（预计）
- T0-T15m：Smoke + 构建/静态检查
- T15-T45m：RLS + Auth 深度验证
- T45-T75m：功能与 E2E checklist
- T75-T105m：视觉回归（授权后）
- T105-T120m：汇总报告与结论

