# split-brain 病灶修复路线图（BL-100~107 排期）

> **来源：** docs/reviews/full-feature-chain-audit-2026-06-09.md（全功能链路审计，6 高危 + 8 中危）
> **决策：** 用户 2026-06-09 — 全部入 backlog + 编成合理批次，BL-099 done 后**依次推进**
> **作者：** Kimi (planner)
> **排序原则：** 用户可见价值 ÷ 风险 ÷ 工作量 —— 快赢止血优先，大工程基建居中，清债收尾殿后。每波启动时 Planner 按惯例重评范围并写 spec。

## 触发与顺序

```
BL-099 (building, 当前) ──done──► 波0(BL-108 插队) ──► 波1 ──► 波2 ──► 波3 ──► 波4
```

每波 = 一个批次，启动时（前一波 done）由 Planner 把该波的 BL 项并入 features.json、写 spec。下表是**预排**，非锁定。

> **波0 插队(2026-06-09 用户决策)：** BL-108 爬虫暂停开关 —— 用户监控页观察 refresh 持续消耗成本，要手动管控。独立于 split-brain(爬虫 repo + kolmatrix UI)，排在 BL-099 done 后**第一优先**，先于下面的 split-brain 波次。spec docs/specs/BL-108-crawler-pause-switches-spec.md · ADR-019。爬虫端走 upstream-patch(用户 merge+部署)。

## 波次安排

### 🟢 波1 — split-brain 快赢止血（用户可见、低风险、小改动）— **批次 BL-110(BUILDING/DONE 见 progress.json)**
**目标：一个批次清掉大部分用户可见的脏卡/死链/数据错乱。** 全是读侧/UI 小修，互相独立、各自可测。
> 2026-06-10 开批 = **BL-110**，合并下表 BL-101~104(已从 backlog 移除)。H6 Edit Brief 死链移至波3 BL-105。

| BL | 修什么 | 改动面 | 备注 |
|---|---|---|---|
| BL-104 | `/kols` 面包屑 404 死链 | 改 1 链接（→/match 或 redirect） | 仅 /kols；Edit Brief 按钮(H6)挪到波3随 campaign 编辑页 |
| BL-103 | `/assets` 泄漏 AI 解释缓存脏卡 | `buildListWhere` + welcome-count 加 type 白名单 | 单点低风险 |
| BL-102 | `kol_campaign` 双 accept 读口径（skip/swap 显示"已接受"） | detail.ts select + AcceptedKolsPanel/count 过滤 | 止血口径；根治（详情页 accept 写 suggestionStatus）可同批或留波4 |
| BL-101(止血部分) | Reply 维度 prod 假数据撑场 | 三处面板加空态/"B4 上线"标注 或 暂移 Replied 维度 | 仅止血，inbound 根治留波2 |

**为何打包：** 4 项都是小改动、用户可见、零/低数据风险，分散开批次开销大；合并一波快速见效。
**产品决策点（spec 时确认）：** BL-101 是"标注空态"还是"移除 Replied 维度"；BL-102 是否一并根治。

### 🟠 波2 — 邮件发送异步化（真 BullMQ）
**目标：修最严重的功能性 bug —— 批量发送 >10 收件人必超时。** 独立成波因为是基建级改动。

| BL | 修什么 | 改动面 |
|---|---|---|
| BL-100 | 邮件发送同步阻塞 + 队列 stub | 内存 JobQueue → 真 BullMQ；发送改异步任务（server action 立即返回 + EmailLog 轮询进度）；prewarm 队列同步迁移 |
| BL-101(根治, 可选) | inbound-email ingestion 写 repliedAt | 依赖 Resend inbound / 回复检测；范围大，视价值决定是否纳入或单列 |

**为何独立：** 队列替换 + 发送异步化 + 进度回报是一组耦合的基建改动，风险与验证都重，不宜与小修混批。涉及 Redis/BullMQ，部署需注意 worker 进程。

### 🔵 波3 — campaign 编辑 UI 补回
**目标：补回用户编辑已建活动的能力（用户 2026-06-09 决策：补回，非退役）。**

| BL | 修什么 | 改动面 |
|---|---|---|
| BL-105 | 补回 campaign 编辑/状态流转/营收/KOL 名单管理 UI 入口 | 下层 5 action + API + lib 已实装有测试，主要是前端接线；H6 Edit Brief 按钮接真编辑页 |

**为何此位：** 功能新增（非 bug），价值中等；下层能力已齐，主要前端工作量。放在快赢与发送基建之后。

### ⚪ 波4 — 链路收口 + ops 核实（清债）
**目标：收口剩余实装不一致与死代码，核实 ops 接线。**

| BL | 修什么 |
|---|---|
| BL-107 | 杂项收口：M4 KOL 详情软删过滤 / M5 tsvector 死码 / M6 孤儿 API（kols PATCH、campaigns kols REST、relationship-status REST）/ M7 假 AI 语义搜索（接线或移除 ?ai=）/ M8 ROI 喂模型硬编码 + 低优死代码 |
| BL-106 | KPI 快照 cron prod 接线核实（登 VPS 查 crontab 或把调度纳入仓库 vercel.json/GH Actions） |

**为何殿后：** 多为技术债/观察项，无即时用户可见损害；BL-102 的根治（若波1未做）可并入此处。

## 备注

- **可调整：** 若你认为邮件发送之痛最急，可把**波2 提前到波1 之前**；若想先看快赢效果再投基建，则维持现序。
- **快赢可拆 hotfix：** 波1 里 BL-103/BL-104 极小，若想绕过完整批次走铁律 #9 hotfix 也可，但合并成波1 一次验收更省 Codex 轮次。
- **每波独立 signoff：** 各波 done 后 Evaluator 出 signoff，再启下一波。
- **部署：** 各波部署仍由用户手动触发（与现行一致）。
