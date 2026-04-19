# ADR-010: Domain Strategy — kolquest.com Brand Adoption

## Status

**Accepted**

- 日期：2026-04-19
- 作者：用户决策（域名选择 + 迁移策略 + 发件结构）+ Kimi 落地
- 相关批次：BI3 F006（DNS + Nginx redirect）/ B4（邮件集成依赖此域名）

## Context

KOLMatrix 初期只有 `kol.guangai.ai` 主应用域名（公司根域 `guangai.ai` 的子域）。业务中期发现 **需要独立品牌域 + 独立发件域** 两个诉求：

1. **品牌域：** `kol.guangai.ai` 长、非独立品牌（与 guangai.ai 绑定），不适合对外展示 / 市场物料
2. **发件域：** 邮件触达（B4 功能）应与主站域隔离（防止邮件 spam 影响主站 reputation）

域名讨论从 `kolmatrix.com`（最贴品牌名）开始，但已被注册。探索 80+ KOL + 各方向的组合（gaming / AI / tech / data），用户选定 **`kolquest.com`** 并完成注册。

同时需决定：
- 主站是否立即迁移到 `kolquest.com`？
- 发件用主域还是子域（mail/outreach）？

## Decision

### 1. 注册 `kolquest.com`（已完成，2026-04-19）

- 选择理由：
  - 游戏感强（Quest = 探索 / 任务 / 冒险，游戏原生词汇）
  - 发音好、8 字母短、`.com` 权威
  - 业务契合："帮你 quest 全球 KOL"
  - 价格亲民（~$12/年）

- **不买 `.gg` 伴侣域**（目前不必要，未来可补）

### 2. 主站暂不迁移（选项 B）

- **保留：** `kol.guangai.ai` 作为主应用入口（B1-B5 业务期间）
- **kolquest.com 的作用：**
  - 301 redirect 到 `kol.guangai.ai`（任何人访问 kolquest.com 跳主站）
  - 根域发件（`marketer@kolquest.com`）
- **未来迁移触发：** 业务稳定 / 商业化 / 融资节点时评估

### 3. 发件用根域（选项 C：`marketer@kolquest.com`）

- **理由：** kolquest.com 无 web 主站流量（只做 redirect），reputation 风险可控；根域发件视觉最专业
- **对比放弃的选项：**
  - A/B 子域（`mail.kolquest.com` / `outreach.kolquest.com`）：多一层命名，不必要
  - 主站直发（`marketer@kol.guangai.ai`）：污染主站 reputation，风险大

### 4. DNS + Nginx 具体配置（BI3 F006 执行）

```
# DNS（用户在注册商面板配）
kolquest.com            A     → 34.180.93.185
www.kolquest.com        CNAME → kolquest.com
kolquest.com            TXT   → "v=spf1 include:_spf.resend.com ~all"
_dmarc.kolquest.com     TXT   → "v=DMARC1; p=quarantine; rua=mailto:dmarc@kolquest.com"
# DKIM CNAME 在 B4 接 Resend 时补
```

```nginx
# Nginx（VPS 端，BI3 F006 落地）
server { listen 443 ssl; server_name kolquest.com www.kolquest.com;
         return 301 https://kol.guangai.ai$request_uri; }
```

## Consequences

### 正面

- **品牌独立性：** `kolquest.com` 不受 `guangai.ai` 主域发展影响
- **发件专业感：** `marketer@kolquest.com` 视觉比 `marketer@kol.guangai.ai` 或 `marketer@mail.kolquest.com` 更专业
- **SEO 资产启动：** kolquest.com 从 BI3 开始建立 reputation，未来主站迁移时无需从 0 开始
- **成本低：** $12/年 vs 买 `.ai` / `.gg` / 多域组合
- **零品牌混乱：** 仅 1 个品牌域，不用管多域身份

### 负面

- **项目名 ≠ 域名：** 项目 repo 是 `kolmatrix`，域名是 `kolquest.com`。有潜在命名混乱（用户看到域名会以为产品叫 "KOL Quest"）
- **未来迁移成本：** 如果主站迁到 `kolquest.com`，要改 NextAuth callback URL / CORS / 所有硬编码 URL
- **邮件 reputation 冷启动：** kolquest.com 全新域，B4 发件初期需"暖机"（2-4 周低频发件建 reputation）

### 中性

- 本 ADR 不决策"是否改项目名为 KOLQuest"（留未来评估）
- 不买 `.gg` 但保留未来追加选项

## Alternatives Considered

### 方案 A（买 `kolmatrix.com`，已拒绝）

- **拒绝理由：** 已被他人注册，不可得

### 方案 B（用子域 `mail.kol.guangai.ai` 发件，已拒绝）

- **拒绝理由：** 品牌感弱（邮件显示 `@mail.kol.guangai.ai` 看起来像公司内部系统）；也无法复用为未来独立品牌域

### 方案 C（买 `.io` / `.ai` / `.gg` 旗舰域 `kolmatrix.io` 等，已拒绝）

- **拒绝理由：** `.io` $30-50/年 / `.ai` $80-150/年 比 `kolquest.com` $12/年贵 3-10 倍；且 `kolquest` 的游戏感比 `kolmatrix` 更贴业务

### 方案 D（立即迁移主站到 kolquest.com，已拒绝）

- **拒绝理由：** 当前 B1 业务开发在即，迁移会改 NextAuth / CORS / 环境变量多处，风险大；kol.guangai.ai 已有 TLS + Nginx + NextAuth 配置完整，迁移收益 < 风险
- **未来触发：** 商业化 / 有外部用户 / 融资时再评估

### 方案 E（子域 `mail.kolquest.com` / `outreach.kolquest.com` 发件，已拒绝）

- **拒绝理由：** kolquest.com 无 web 主站流量，不需要子域隔离；根域 reputation 就是邮件 reputation，直接发最专业

## References

- **域名注册日期：** 2026-04-19
- **落地批次：** BI3 F006（DNS + Nginx redirect + Let's Encrypt + SPF/DMARC）
- **发件接入批次：** B4（Resend DKIM CNAME 补齐）
- **相关 ADR：**
  - ADR-001（Option α 定义 BI3 在 B1 之前，提供落地窗口）
  - ADR-009（AI Gateway 集成不受 KOLMatrix 域名变化影响）
- **Specs：**
  - `docs/specs/BI3-domain-and-tls-spec.md` F006 具体实现
  - `docs/dev/infrastructure.md` §4 域名 TLS 章节
  - `.auto-memory/environment.md` 记录域名状态

## Notes

### 项目名变更讨论（未决）

当前 repo 叫 `kolmatrix`，品牌域叫 `kolquest.com`。二者不统一。

**未来可能触发改名的情景：**
- 商业化 / 对外市场物料时发现混乱
- 投资人 / 合作伙伴 feedback 项目名与域名不符
- 用户直觉产品叫 "KOL Quest"

**改名成本（如决定）：** ~1-2 小时批量替换 UI / 文档（`KOLMatrix` → `KOLQuest`），repo 名可不改（`tripplemay/kolmatrix` 保留）。

### 重新评估触发条件

- 主站迁移到 kolquest.com（方案 D 反转）→ 新 ADR 或本 ADR 升级
- 邮件 reputation 因 spam 被破坏 → 考虑换发件域
- 未来业务分离（如海外 vs 国内）需多域 → 新 ADR
