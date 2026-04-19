# ADR-009: AI Gateway Integration Strategy

## Status

**Accepted**

- 日期：2026-04-19
- 作者：Kimi（Planner）+ 用户决策（SDK / 模型分级 / Prompt 管理 / 预算）
- 相关批次：B2 AI 评分（依赖本决策）/ B4 邮件个性化 / 后续所有 AI 调用

## Context

B2 AI 评分批次需要集成 aigcgateway（项目位于 `~/project/aigcgateway`，KOLMatrix 的姊妹项目）。B2 开工前必须明确：

1. **技术集成方式**：SDK / HTTP fetch / OpenAI 兼容客户端？
2. **baseUrl 与部署关系**：生产 / 开发 / 测试分别走哪里？
3. **模型选择策略**：22 家 provider 如何按场景挑？
4. **Prompt 管理**：自管还是用 aigcgateway Action 版本化？
5. **预算与成本控制**：月上限多少？

这些是**跨批次影响**的决策（B2/B4 / 未来所有 AI 调用都走此路径），不可逆性高（切换 SDK 要重写集成层），有多方案可选。

**aigcgateway 现状（2026-04-19 confirmed）：**
- 生产 API：`https://aigc.guangai.ai/v1/`（OpenAI 兼容格式）
- 控制台：`https://aigc.guangai.ai`（生成 API key、管理 Action / Template）
- MCP 端点：`https://aigc.guangai.ai/mcp`（25 tools）
- 支持 22 家 provider（OpenAI / Anthropic / DeepSeek / Zhipu / Volcengine / Qwen / OpenRouter / MiniMax / Moonshot / Gemini / iFlytek / StepFun / xAI / Mistral / Groq 等）
- 官方 SDK：`@guangai/aigc-sdk`（零依赖，Node 18+，TypeScript）
- **与 KOLMatrix 同 Tokyo VM 部署**（34.180.93.185）
- 预充值计费（prepaid）+ 健康检查自动降级

## Decision

**四层决策：**

### 1. SDK 选型：`@guangai/aigc-sdk`

```typescript
import { Gateway } from '@guangai/aigc-sdk';

const gw = new Gateway({
  apiKey: process.env.AIGC_GATEWAY_API_KEY,
  baseUrl: process.env.AIGC_GATEWAY_BASE_URL,
});
```

**包装位置：** `src/lib/aigc.ts`（单例 + withTenantAudit 包装，统一写 ai_call_log）

### 2. baseUrl 配置

| 环境 | URL | 备注 |
|---|---|---|
| 生产 | `http://localhost:3099/v1/`（同 VM 走内网） | 免公网延迟 + 免走 Nginx TLS |
| Staging | `http://localhost:3099/v1/` 或独立 staging aigcgateway | BI3 staging 启动时确定 |
| 本地开发 | `https://aigc.guangai.ai/v1/` 直连生产 aigcgateway | 开发机无本地 aigcgateway |
| 测试（BI1 F004 MSW） | MSW handler mock | 不真调用 aigcgateway |

**关键红利：** 生产同 VM 部署 → B2 每条 KOL 评分调用 AI 网关**不走公网**，延迟 < 10ms，无流量费。

### 3. 模型分级策略（按场景分组）

> **修订 2026-04-19：** 通过 `mcp__aigc-gateway__list_models` 核对实际可用模型，更新矩阵。aigcgateway 目前提供 21 个文本模型，包含 6 个中国模型（Qwen / GLM / Doubao / Ernie / Kimi / MiMo）对中日韩场景友好。

按 "成本 / 精度" 三档分级：

| 档位 | 用途 | 首选模型 | 定价（in / out per 1M tokens） | 估算 cost（1000 次调用） |
|---|---|---|---|---|
| **批量档（L1）** | 日常 KOL crawler 入库评分、粗筛 | `deepseek-v3` | $0.26 / $0.38 | **~$0.21**（500 in + 200 out 平均） |
| **批量档备选** | 中文/CJK KOL 评分 | `qwen3.5-flash` | $0.065 / $0.26 | ~$0.08（更便宜） |
| **精评档（L2）** | 客户候选名单 top 50 精评、品牌安全 | `claude-haiku-4.5` | $1 / $5 | **~$3.5**（1000 in + 500 out） |
| **精评档顶级** | 超高价值决策（旗舰项目） | `gpt-5` | $2.5 / $15 | ~$13 |
| **匹配档（L3）** | Campaign × KOL 匹配、邮件个性化 | `gemini-3-flash` | $0.5 / $3 | **~$0.85**（500 in + 200 out） |
| **匹配档替代** | 需要 search + vision | `grok-4.1-fast` | $0.2 / $0.5 | ~$0.20 |

**新发现：** 实际月成本远低于原估（DeepSeek V3 实测 $0.26 / $0.38 vs 之前粗估），按 10,000 KOL 评分 / 月计算 **L1 仅 ~$2**。$100 预算充足。

**选择逻辑（代码中）：**

```typescript
// src/features/kol-eval/model-selector.ts
export function selectModel(
  purpose: 'bulk_eval' | 'precision_eval' | 'campaign_match',
  locale?: string
): string {
  // CJK 场景用 Qwen（更便宜且对中日韩文本更熟）
  if (purpose === 'bulk_eval' && (locale === 'zh' || locale === 'ja' || locale === 'ko')) {
    return 'qwen3.5-flash';
  }
  return {
    bulk_eval: 'deepseek-v3',
    precision_eval: 'claude-haiku-4.5',
    campaign_match: 'gemini-3-flash',
  }[purpose];
}
```

**降级：** 首选模型失败 → aigcgateway 自动降级到次选（gateway 内建策略，应用层无感）。

### 4. Prompt 管理：aigcgateway Action（MCP 驱动创建）

**决策：** Prompt 模板通过 aigcgateway Action 管理。**Planner 用 MCP 工具直接操作 Actions**，不需要用户登控制台。

**关键 MCP 工具（ADR 修订 2026-04-19 增补）：**

| MCP 工具 | 用途 |
|---|---|
| `mcp__aigc-gateway__list_models` | 查询当前可用模型 + 价格 |
| `mcp__aigc-gateway__list_actions` | 列出现有 Actions |
| `mcp__aigc-gateway__create_action` | 创建新 Action（含 messages + variables） |
| `mcp__aigc-gateway__create_action_version` | 加新版本（prompt 迭代） |
| `mcp__aigc-gateway__activate_version` | 切换活跃版本 |
| `mcp__aigc-gateway__run_action` | 执行 Action（支持 `dry_run` 预览不计费） |
| `mcp__aigc-gateway__get_action_detail` | 查看 Action 详情（messages / 历史版本） |
| `mcp__aigc-gateway__get_log_detail` | 查调用详情（traceId → prompt/output/cost） |
| `mcp__aigc-gateway__list_logs` | 按条件列调用日志 |
| `mcp__aigc-gateway__get_usage_summary` | 按日期 / Action 聚合成本 |
| `mcp__aigc-gateway__get_balance` | 查账户余额 + 交易历史 |
| `mcp__aigc-gateway__create_api_key` | 为 KOLMatrix 创建独立 pk_xxx |
| `mcp__aigc-gateway__create_project` | 创建 project 隔离（推荐为 KOLMatrix 单开 project） |

**项目隔离（ADR-009 §4.5 新增决策）：**

当前 aigcgateway 已有 15 个 Actions（内容生产相关，非 KOL）。为避免命名混乱 + 便于计费分析，**B2 启动时用 `mcp__aigc-gateway__create_project` 创建独立 "kolmatrix" project**，所有 KOL 相关 Actions 隔离在此 project 下。

**B2 spec 阶段的新工作流（MCP-driven）：**

```
1. Planner 起草 prompt 初版（4 个 Actions × 每个 3-5 候选）
    ↓
2. 用户 review prompt（markdown diff, 不需要控制台）
    ↓
3. 用户 approve 后, Planner 用 MCP:
    - create_project("kolmatrix")
    - create_action(name, model, messages, variables) × 4
    - run_action(dry_run=true) 预览变量渲染
    - run_action 在 seed KOL 数据上真实测试
    ↓
4. 结果不满意 → create_action_version 加新版本 + activate_version 切换
    ↓
5. 最终稳定 → Action ID 写入 B2 spec + features.json
```

**使用方式（KOLMatrix 代码中）：**

```typescript
// src/features/kol-eval/evaluator.ts
import { gw } from '@/lib/aigc';

const result = await gw.runAction({
  actionId: 'kolmatrix-kol-eval-bulk',  // MCP 创建时指定 ID
  variables: {
    kol_name: kol.displayName,
    kol_bio: kol.bio,
    platform: kol.platform,
    followers: kol.followerCount.toString(),
    categories: kol.categories.join(', '),
  },
  version_id: 'v1',  // optional, 默认活跃版本
});
// result = { score: 87, breakdown: {...}, tags: [...] }
```

**Prompt 模板初版由 Planner 起草，用户 review 迭代。** B2 spec 阶段启动此工作。

### 5. 预算上限

**月度预算：$100 USD**

估算分配（**2026-04-19 按实际价格重算**）：
- KOL 批量评分（L1 DeepSeek V3 ~$0.00021/次）：$5 / 月 ~25,000 次调用
- KOL 精评（L2 Claude Haiku 4.5 ~$0.0035/次）：$35 / 月 ~10,000 次调用
- Campaign 匹配（L3 Gemini 3 Flash ~$0.00085/次）：$10 / 月 ~12,000 次调用
- B4 邮件个性化（L2 Claude Haiku ~$0.005/次, 含长邮件）：$30 / 月 ~6,000 封
- Buffer：$20（应急 / 迁移到更贵模型时缓冲）

**实际比原估低很多：** 原 ADR-009 未 MCP 核对价格时粗估 $100，实际用量下 ~$80 已够舒展。预算有富余。

**当前账户状态（2026-04-19 通过 mcp__aigc-gateway__get_balance 查证）：** $49.81 USD 余额（已充值）。够 KOLMatrix B2 起步 2-3 周使用。

**超支防线：**
- aigcgateway 预充值机制 → 账户余额用完自动停止调用（硬限）
- KOLMatrix `ai_call_log` 表记录每次调用 cost → 月度聚合可告警（软限）
- 每日 `mcp__aigc-gateway__get_usage_summary` 查询（可写 cron 自动告警）
- 初期每周末人工核查 → 稳定后加 cron 自动告警

### 6. 审计与追溯

每次 AI 调用**双重审计**：

1. **本地 `ai_call_log` 表**（待 B2 migration 建）—— KOLMatrix 侧，含 tenant_id 关联
2. **aigcgateway 原生 audit** —— 通过 `mcp__aigc-gateway__get_log_detail` + `traceId` 查完整 prompt/output（本地仅存 summary + cost）

**查询姿势：**
- 本地看 `ai_call_log` 表分析业务逻辑
- MCP `get_log_detail(trace_id)` 看完整 AI 交互（prompt + output + model + 时延）
- MCP `get_usage_summary(from_date, to_date)` 聚合成本分析

**Schema：**

```sql
CREATE TABLE ai_call_log (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID,
  purpose TEXT,           -- 'bulk_eval' / 'precision_eval' / 'campaign_match' / 'email_personalize'
  action_id TEXT,         -- aigcgateway Action ID
  model TEXT,             -- 'deepseek-v3' / 'claude-sonnet-4' / ...
  prompt_tokens INT,
  completion_tokens INT,
  total_tokens INT,
  cost_usd DECIMAL(10,6),
  latency_ms INT,
  trace_id TEXT,          -- aigcgateway 返回的 traceId, 联调用
  status TEXT,            -- 'ok' / 'failed' / 'timeout'
  kol_id UUID,            -- 关联 KOL（如有）
  campaign_id UUID,       -- 关联 Campaign（如有）
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Consequences

### 正面

- **技术栈统一：** 同公司 SDK 同步维护，无 breaking change 拖累
- **零公网延迟：** 同 VM 走内网，B2 AI 评分 pipeline 速度优
- **成本可控：** 预充值 + `ai_call_log` 审计 + 月度 $100 上限
- **灵活切换模型：** 三档策略可随时调整（改 `model-selector.ts` 一处）
- **降级健壮：** aigcgateway 自动切 provider，应用层无感
- **Prompt 迭代快：** Action 版本化，不改代码就能切 v1→v2

### 负面

- **耦合 aigcgateway 可用性：** 如果 aigcgateway 宕机，KOLMatrix AI 功能全挂（降级到 mock）
- **新依赖 @guangai/aigc-sdk：** KOLMatrix `package.json` 加新 dep
- **Prompt Action 需在 aigcgateway 维护：** 跨项目协作，某些场景不如自管灵活
- **模型切换需配合控制台：** 改 Action 需登 aigcgateway 控制台（不能纯代码驱动）

### 中性

- `ai_call_log` 表增加 DB 写入负担（每次 AI 调用 1 条 insert），但量级可控
- 月底核查 cost 是手工工作，未来可加告警
- 本地开发走生产 aigcgateway 消耗真实 API key → 需要给 KOLMatrix 分配独立 dev API key

## Alternatives Considered

### 方案 A（用 OpenAI npm 包直接对接 aigcgateway OpenAI 兼容端点，已拒绝）

```typescript
import OpenAI from 'openai';
const openai = new OpenAI({ baseURL: 'https://aigc.guangai.ai/v1', apiKey: '...' });
```

- **拒绝理由 1：** 增加 `openai` 依赖包，但我们不用 OpenAI 任何专属特性
- **拒绝理由 2：** aigcgateway 专属能力（Action / Template / 跨 provider 统一）用不上
- **拒绝理由 3：** 错过 aigcgateway SDK 升级（如未来加功能 `gw.embed()`）

### 方案 B（裸 fetch 调用 OpenAI 兼容端点，已拒绝）

```typescript
const res = await fetch('https://aigc.guangai.ai/v1/chat/completions', { method: 'POST', ... });
```

- **拒绝理由 1：** 无 TypeScript 类型
- **拒绝理由 2：** 需要自己处理流式、错误、重试
- **拒绝理由 3：** 违反 "用官方 SDK" 原则（除非 SDK 缺能力）

### Prompt 管理方案 Y（自管 `prompts/*.md` 文件，已拒绝）

- **拒绝理由 1：** Prompt 改动需要重新 deploy KOLMatrix
- **拒绝理由 2：** 版本化靠 git，不如 aigcgateway Action 原生版本切换灵活
- **拒绝理由 3：** 不能跨项目复用（aigcgateway Action 可被其他项目调用）

### 模型策略 Z（一律用最便宜 DeepSeek V3，已拒绝）

- **拒绝理由 1：** 精评场景（Claude-level 质量）降档影响业务决策质量
- **拒绝理由 2：** 批量 vs 精评成本差 20 倍，值得分档省钱
- **拒绝理由 3：** 用户明确选 "根据场景分组"

## References

- **aigcgateway 项目：** `~/project/aigcgateway`（sibling project）
- **aigcgateway SDK README：** `~/project/aigcgateway/sdk/README.md`
- **aigcgateway CLAUDE.md：** 包含完整技术栈与命令
- **aigcgateway environment.md：** 生产环境地址 / 测试账号
- **Specs（待起草）：**
  - `docs/specs/B2-ai-evaluation-spec.md`（BI3 完成后由 Planner 起草）
  - `prompts/` 目录结构待 B2 spec 阶段定义
- **相关 ADR：**
  - ADR-007（多租户 RLS 策略：`ai_call_log` 也需 tenant_id + RLS）
  - ADR-001（Option α 顺序：B2 在 BI3 后）

## Notes

### Prompt 初版起草计划（Planner 职责）

B2 启动前（BI3 完成后），Planner 起草以下 prompt 模板候选给用户 review（**MCP 驱动工作流**）：

1. **KOL 批量评分**（L1 DeepSeek V3）：从 KOL bio + 粉丝数 + 内容类型 → 输出 0-100 分 + 4 维 breakdown
2. **KOL 精评**（L2 Claude Haiku 4.5）：从完整 KOL 画像 → 输出详细评分 + 文字说明 + 风险提示
3. **Campaign × KOL 匹配**（L3 Gemini 3 Flash）：输入 campaign 定位 + KOL 画像 → 输出匹配度 0-100 + 推荐理由
4. **邮件个性化**（L2 Claude Haiku，B4 用）：输入 KOL 画像 + campaign 描述 → 输出个性化邮件主题 + 正文

每个模板 3-5 个版本候选，用户 review 后 **Planner 用 `mcp__aigc-gateway__create_action` 直接建 Action**（不需要用户登控制台点）。迭代通过 `create_action_version` + `activate_version`。

### aigcgateway 现状（2026-04-19 通过 MCP 核对）

| 项 | 状态 |
|---|---|
| 账户余额 | $49.81 USD |
| 可用文本模型 | 21 个（含 Anthropic / OpenAI / Google / DeepSeek / Qwen / GLM / Doubao / Ernie / Kimi / MiMo / Grok / Minimax） |
| 已有 Actions | 15 个（内容生产类，非 KOL 相关） |
| KOLMatrix 独立 project | **未创建，B2 启动时用 `mcp__aigc-gateway__create_project` 建** |
| KOLMatrix 独立 API Key | 未分配，B2 启动时用 `mcp__aigc-gateway__create_api_key` 分 dev/prod |

### 重新评估触发条件

- aigcgateway 架构变更（如废弃 Action 机制）→ 调整 Prompt 管理策略
- KOLMatrix 需要独立 aigcgateway 部署（安全 / 合规理由）→ 调整 baseUrl
- 月度 AI cost 超 $500 → 加独立预算控制 + 分 tenant 计费
- 新 provider / 模型出现（如 GPT-5 发布）→ 更新模型选择矩阵
- aigcgateway 不可用率 > 1% → 考虑备用 AI 供应商（降级路径外的二级兜底）

### 测试策略（BI1 F004 MSW 关联）

B2 启动前 BI1 F004 MSW 已就位。B2 测试时：
- Unit test：直接 mock `@guangai/aigc-sdk` 返回预定义 JSON
- Integration test：用 MSW 拦截 `/v1/chat/completions` 和 `/v1/actions/*`
- E2E test：真调 aigcgateway dev 账户（可选，按 cost 决定）
