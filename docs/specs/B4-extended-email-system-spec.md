---
name: B4-extended-email-system
description: BM2 outreach 邮件系统增强 - Resend webhook + 模板编辑器 + 打开率/回复率追踪 + 自动退订
status: draft (framework only)
created_by: Kimi (Planner)
created_at: 2026-04-27
estimated_effort: 7-10 day（最终拆分待 Post-MVP 反馈细化）
prerequisites:
  - MVP 上线 ≥ 4 周（充分收集种子用户邮件触达反馈）
  - BIx-staging-automation done（依赖 staging 真实邮件 webhook 调试）
  - aigcgateway 余额充足（如新增 AI 模板生成功能）
---

# B4-extended — 邮件系统增强

> **本 spec 是框架版（framework only）**，详细 acceptance 留待 MVP 上线后第 4 周根据种子用户反馈细化。本批次目标：在 MVP 验证「Resend mock fallback + 手动模板触发」可行后，把邮件能力升级到「production-grade 营销邮件系统」。

## 1. 背景与目标

### 1.1 BM2 已实现（基线）

- ✅ Resend API 集成（fallback to mock log）
- ✅ 10 套 system EmailTemplate（5 类目 × en/zh）
- ✅ AI 定制（Claude Haiku via aigcgateway）
- ✅ EmailLog 记录（status: queued/sent/mock_sent/failed）
- ✅ KolCampaign.contactStatus 联动更新（pending → contacted）
- ✅ event_log 埋点（email.sent / ai_customize_clicked / accepted）
- ✅ 邮件底部最小合规自然语言 opt-out（PRD §11.6）

### 1.2 缺口（PRD §11.4 + §11.6 明示留 B4 做）

| 缺口 | 影响 | 紧迫度 |
|---|---|---|
| **无 Resend webhook 接收** | 不知道邮件 delivered/opened/clicked/bounced/complained | 高（PRD §11.4 已锁 B4 做） |
| **无打开率 / 回复率追踪** | Marketer 看不到 outreach 效果，无法优化模板 | 高（PRD §2.2 指标 AI 定制采纳率 ≥40% 需要 tracking） |
| **模板用户不可自定义** | 仅 system 模板 10 套，租户无法做品牌一致的邮件 | 中（影响成熟度感知，不影响 MVP 路径） |
| **退订自动化** | 当前人工 handle 退订，规模化后会失控 | 中（MVP 发量小，规模 > 100 用户后必须做） |
| **bounce / complaint 自动处理** | 持续给 hard bounce 邮箱发会损害 sender reputation | 高（>5% bounce rate 会被 Resend 限流） |
| **发送队列 + 频控** | 当前前端节流 10 msg/min + 后端 sleep guard，规模化后会卡 UI | 中（B5 BullMQ workers 完整版才能上） |
| **邮件预览 / 测试发送** | 当前预览仅 textarea，无法看真实渲染效果 | 低（marketer 可自己发到测试邮箱看） |

### 1.3 目标

**让 KOLMatrix 邮件系统从「能发」进化到「能优化效果 + 合规规模化」。**

具体业务指标（MVP 上线 4 周后基线 + 本批次目标）：
- 邮件 deliverability ≥ 95%（hard bounce < 5%）
- 打开率追踪覆盖率 100%（每封邮件 webhook open event 记录）
- AI 定制采纳率（PRD §2.2 指标）≥ 40%（基线 + 本批次维护）
- 模板自定义使用率 ≥ 30%（用户自建模板比 system 模板的占比，本批次目标）
- unsubscribe 自动化（MVP 上线 4 周后人工 handle 退订率 < 5/周表示需要自动化）

## 2. 范围（候选 features，待 MVP 反馈后裁剪）

### F001 — Resend webhook 接收 endpoint + 5 事件处理

**范围：**
- 新建 `POST /api/v1/email/webhook/resend`（公开 endpoint，HMAC-SHA256 签名校验）
- 接收事件：`email.delivered` / `email.opened` / `email.clicked` / `email.bounced` / `email.complained`
- EmailLog 状态扩展：增加 `delivered_at` / `opened_at` / `clicked_at` / `bounced_at` / `complained_at` / `bounce_reason` 字段
- Resend dashboard 配 webhook URL（生产 + staging 各一）
- 重试 + 幂等（resend 可能重发同一事件，按 message_id+event 去重）
- audit_log 'email.webhook_processed'

**依赖：** Resend API key（已有）+ webhook signing secret（需用户在 Resend dashboard 拿）

### F002 — 邮件模板编辑器（用户自定义模板）

**范围：**
- 新增页面 `/templates`（导航栏 + 控制台 sidebar）
- 列表：system 模板（read-only）+ user 模板（可 CRUD）
- 编辑器：
  - 选型决策：**markdown** 还是 **rich text WYSIWYG**？（待用户裁决）
  - 推荐 markdown（与现有 weekly-report 渲染栈一致 + git 友好 + AI 友好）
- 变量插入助手（{{kol.name}} {{product.name}} 等，UI 提供 chip 点击插入）
- 实时预览（mock variables 填入示例值）
- locale 选择（en / zh / ja / ko / es）
- 测试发送（发到当前 user.email）
- EmailTemplate.tenantId 非空（区分 system vs user 模板）
- audit_log 'template.created/updated/deleted'

**依赖：** EmailTemplate schema 已就绪（BM2 F001）

### F003 — 打开率 / 回复率 dashboard

**范围：**
- `/outreach` 列表加增强字段：模板使用次数 / 平均打开率 / 平均回复率（per template）
- `/campaigns/:id` 详情 Email Performance chart 升级：从单纯 sent 时序 → 加 opened/clicked 双线
- Top 模板排行榜（按 open rate / reply rate / click rate DESC，help 用户复用高效模板）
- Bottom 模板告警（< 20% open rate 触发"模板可能进垃圾箱" notice）
- AI 模板优化建议（基于历史数据，调 aigcgateway 给改进建议）— 可选 stretch goal

**依赖：** F001 webhook 数据积累 ≥ 2 周

### F004 — 自动退订系统

**范围：**
- 每封邮件底部 auto-inject `<a href="https://kol.guangai.ai/unsubscribe?token={kol-specific-token}">Unsubscribe</a>` 链接
- token 生成：HMAC of (kol_id + tenant_id + secret)，无过期
- `GET /unsubscribe?token=xxx`：验证 token → 显示确认页（一键退订）
- `POST /api/unsubscribe`：写入 KolUnsubscribe 表（kol_id, tenant_id, unsubscribed_at, reason 可选）
- outreach 流：发送前检查 KolUnsubscribe 黑名单，命中则跳过 + UI 灰显 + tooltip "已退订"
- audit_log 'kol.unsubscribed'
- legal compliance：CAN-SPAM act + GDPR Art. 21 right to object

**依赖：** 新表 KolUnsubscribe（schema migration）

### F005 — Bounce / complaint 自动处理

**范围：**
- F001 webhook 收到 hard bounce 事件 → 自动给 KOL 标记 `email_status='bounced'`（Kol schema 新字段）
- 后续 outreach 流：bounced KOL 自动 disabled + tooltip "邮箱无效"
- complaint 事件 → 触发 KolUnsubscribe 写入 + `email_status='complained'`
- soft bounce（mailbox full / temporary）→ 重试机制（B5 BullMQ workers 才能实现，本批次先记录不重试）
- 周期性清理（每月 cron）：删除 `email_status='bounced'` 的 KOL email 字段（不删 KOL 本身）

**依赖：** F001 webhook + Kol schema 扩展

### F006 — 发送队列 + 频控（BullMQ workers）

**范围：**
- B5 BullMQ workers 上线（roadmap 已有规划，不属本批次主线）
- 邮件发送从同步 await Resend 改为异步 enqueue
- 频控：每 tenant 每分钟最多 10 封 / 每天最多 1000 封（user-tenant plan 决定）
- worker 失败重试 3 次（30s / 5min / 30min backoff）
- failed 邮件入 dead letter queue + admin 看板可见

**依赖：** B5 BullMQ workers（独立批次或本批次合并，待决定）

### F007 — 邮件预览增强

**范围：**
- 在 outreach 页 EmailTemplate selector 旁加 "预览" 按钮
- 弹层显示真实 HTML 渲染（基于当前选中 KOL 数据 fill 变量）
- 模拟移动端 / 桌面端 viewport 切换
- 测试发送按钮（发到 marketer 自己的 email）

**依赖：** 可与 F002 模板编辑器内嵌共用预览组件

## 3. 关键设计决策（待 Post-MVP 反馈细化）

| 决策 | 候选方案 | 待决议时机 |
|---|---|---|
| 模板编辑器选型 | (a) markdown + react-markdown（同 weekly-report 栈） / (b) WYSIWYG 如 lexical / tiptap | F002 启动前 |
| webhook 签名验证库 | Resend 官方 SDK 或手写 HMAC | F001 启动前 |
| KolUnsubscribe 表设计 | (a) per-tenant + per-kol / (b) 全局 email-level（影响多租户场景） | F004 启动前 |
| BullMQ vs PgBoss | (a) BullMQ + Redis（roadmap 默认） / (b) PgBoss（pg-only，无新依赖） | F006 / B5 启动前 |
| AI 模板优化建议是否做 | 视种子用户反馈（如多人提"模板效果差"才做） | MVP 上线 4 周后 |
| 模板分享（user 模板能否跨 tenant 分享） | 不做（隔离原则）vs 做（marketplace 概念） | Post-MVP B7+ |

## 4. 风险与对策

| 风险 | 严重度 | 对策 |
|---|---|---|
| Resend webhook 配置复杂 + 签名校验易错 | 中 | F001 staging 全程调试 + 多种事件类型回归测试 |
| 模板编辑器 markdown vs WYSIWYG 选型分歧 | 中 | F002 启动前 1h 决策会议 + Spike 验证两个方案各做一个 mockup |
| webhook 数据积累慢（< 100 邮件无统计意义） | 中 | F003 推迟到 F001 积累 ≥ 2 周后 |
| 自动退订违反法律（CAN-SPAM / GDPR） | 高 | F004 启动前法律咨询 / 找模板（Resend 社区有现成 unsubscribe 实现） |
| BullMQ workers 引入 Redis 复杂度 | 中 | 评估 PgBoss 替代（现有 Redis 仅 stub，无生产依赖） |
| 邮件 deliverability 下降（spam 投诉率上升） | 高 | 早期实施 F005 bounce 自动处理 + monitoring |

## 5. 与时间线建议

| 阶段 | 时间 | 内容 |
|---|---|---|
| MVP 上线 + 第 1 周 monitoring | 2026-05-05 ~ 05-12 | 收集邮件相关 P0/P1 反馈 |
| 第 2-3 周 monitoring + 数据积累 | 05-12 ~ 05-26 | 统计 deliverability / 退订请求频率 |
| 第 4 周决策会议 + spec 细化 | ~2026-05-30 | 基于实际数据决定本批次 features 取舍 |
| F001 webhook（强烈推荐第一波做） | ~2026-06-01 ~ 06-05 | webhook + 5 事件 + 签名 |
| F005 bounce / complaint 处理（合规关键） | ~2026-06-05 ~ 06-08 | 与 F001 同期做 |
| F004 自动退订（合规关键） | ~2026-06-08 ~ 06-12 | KolUnsubscribe + UI |
| F002 模板编辑器（视用户反馈） | ~2026-06-12 ~ 06-18 | 待决定 markdown vs WYSIWYG |
| F003 dashboard / F007 预览 | ~2026-06-18 ~ 06-22 | F001 数据积累后做 |
| F006 BullMQ workers（视规模） | Post-B5 | 邮件量超过 1000/day 才需要 |

**预估总工时：** 7-10 day（如 F006 单独成批次，则本批次 5-7 day）

## 6. 与其他批次关系

- **依赖：** BM2 outreach 基线（已 done）+ BIx-staging-automation（webhook 调试需要 staging 稳定）
- **解锁：** B7 客户协同筛选（webhook 数据可作为客户决策输入）
- **平行：** B6 KOL crawler sync worker（后台任务架构可借用 BullMQ）

## 7. Post-MVP 反馈触发条件（决定本批次具体启动时机）

启动 B4-extended 的至少一个 trigger：

1. **邮件量增长**：MVP 上线 4 周后，月发送量 ≥ 1000 封 → F001 + F006 急需
2. **deliverability 下降**：bounce rate > 5% → F005 急需
3. **退订请求频繁**：每周 ≥ 5 个手动退订请求 → F004 急需
4. **模板需求**：≥ 3 个种子用户反馈"system 模板不够用，要自定义" → F002 急需
5. **效果数据缺失**：marketer 反馈"看不到邮件效果" → F003 急需

## 8. 引用文档

- `docs/product/KOLMatrix-MVP-PRD.md` §11.4 / §11.6（CRM 简化 + 退订最小合规决策）
- `docs/specs/BM2-campaign-outreach-roi-spec.md`（基线 outreach 实现）
- `docs/specs/roadmap.md` B4（原始 B4 邮件触达计划）+ B8（邮件追踪 webhook）
- `docs/adr/`（如有 ADR 涉及 Resend / 邮件架构）
- Resend 官方文档：https://resend.com/docs/webhooks
- aigcgateway Action `kol-email-customize`（已存在，B4 模板优化建议可复用）

## 9. 待用户决策（spec 细化前）

1. **MVP 上线后第 4 周触发条件**：上述 5 个 trigger 哪个最重要 / 优先做？
2. **F006 BullMQ vs B5 关系**：是否把 F006 拆到 B5 单独做？
3. **F002 模板编辑器选型**：markdown / WYSIWYG / 不做（仅扩 system 模板数）？
4. **法律审核**：F004 自动退订需要法律 review，谁负责？

---

**Spec 状态：** draft framework only（2026-04-27 Planner 起草，留待 MVP 上线 4 周后基于种子用户反馈细化）

**本批次定位：** Post-MVP 第一阶段重点批次（与 BIx-staging-automation 并列，但优先级视反馈而定）
