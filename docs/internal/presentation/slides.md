---
marp: true
theme: uncover
class: invert
paginate: true
size: 16:9
backgroundColor: "#0a0e1a"
color: "#e8eaf0"
style: |
  section {
    font-family: 'PingFang SC', 'Microsoft YaHei', 'Segoe UI', sans-serif;
    background: linear-gradient(135deg, #0a0e1a 0%, #141a2e 100%);
    color: #e8eaf0;
    padding: 28px 56px;
    font-size: 22px;
  }
  h1 {
    color: #6ee7ff;
    font-weight: 700;
    letter-spacing: 0.02em;
    font-size: 1.5em;
    margin: 0 0 0.4em 0;
  }
  h2 {
    color: #a5d8ff;
    font-weight: 600;
    font-size: 1.1em;
    margin: 0.3em 0;
  }
  h3 {
    color: #ffd166;
    font-size: 0.95em;
    margin: 0.4em 0 0.2em 0;
  }
  strong { color: #ffd166; }
  em { color: #6ee7ff; font-style: normal; }
  table {
    border-collapse: collapse;
    margin: 0.4em auto;
    font-size: 0.78em;
    width: 96%;
  }
  th {
    background: rgba(110, 231, 255, 0.12);
    color: #6ee7ff;
    border-bottom: 2px solid #6ee7ff;
    padding: 6px 10px;
  }
  td {
    border-bottom: 1px solid rgba(255,255,255,0.08);
    padding: 5px 10px;
  }
  blockquote {
    border-left: 3px solid #ffd166;
    color: #b8bfd1;
    font-size: 0.85em;
    padding: 0.2em 0.8em;
    margin: 0.5em 0;
    background: rgba(255,209,102,0.05);
  }
  ul, ol { line-height: 1.5; margin: 0.3em 0; font-size: 0.9em; }
  p { margin: 0.4em 0; line-height: 1.4; }
  code {
    background: rgba(110, 231, 255, 0.1);
    color: #6ee7ff;
    padding: 0.05em 0.3em;
    border-radius: 3px;
    font-size: 0.9em;
  }
  pre {
    background: rgba(0,0,0,0.4);
    border: 1px solid rgba(110,231,255,0.15);
    border-radius: 6px;
    padding: 10px 14px;
    font-size: 0.62em;
    line-height: 1.3;
    overflow: hidden;
  }
  section.cover {
    text-align: center;
    justify-content: center;
  }
  section.cover h1 {
    font-size: 2.2em;
    margin-bottom: 0.2em;
  }
  section.cover h2 {
    font-size: 1.3em;
    color: #a5d8ff;
  }
  .grid3, .grid4, .grid2 {
    display: grid;
    gap: 14px;
    margin-top: 12px;
  }
  .grid2 { grid-template-columns: 1fr 1fr; }
  .grid3 { grid-template-columns: 1fr 1fr 1fr; }
  .grid4 { grid-template-columns: 1fr 1fr 1fr 1fr; }
  .card {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(110,231,255,0.2);
    border-radius: 10px;
    padding: 12px 16px;
  }
  .card h3 {
    margin: 0 0 6px 0;
    font-size: 0.95em;
    color: #6ee7ff;
  }
  .card p, .card div { font-size: 0.78em; margin: 3px 0; color: #d0d6e8; line-height: 1.4; }
  .big-num {
    font-size: 2.2em;
    color: #ffd166;
    font-weight: 700;
    line-height: 1;
    margin-bottom: 4px;
  }
  .num-card {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(110,231,255,0.2);
    border-radius: 10px;
    padding: 14px 12px;
    text-align: center;
  }
  .num-card .label {
    font-size: 0.75em;
    color: #b8bfd1;
    line-height: 1.3;
    margin-top: 4px;
  }
---

<!-- _class: cover invert -->

# 一个人 + AI 的 22 天

## KOLMatrix 与 Triad Workflow

Solo dev 如何用多 agent 框架交付企业级 SaaS

<br/>

主讲人　|　2026-05　|　`kol.guangai.ai`

---

## 22 天 + Solo dev + 企业级 SaaS  =  ?

<div class="grid3">

<div class="card">

### 难题 1 · 体量

5 国语言 · 4 平台数据集成
AI 邮件生成 · RLS 多租户
**传统估算：4-5 人 × 3 个月**

</div>

<div class="card">

### 难题 2 · AI 单独失控

· 让 AI 自评 = 失控
· AI 越权改架构 = 失控
· 上下文塞满 = 丢状态

</div>

<div class="card">

### 难题 3 · 多 AI 无方法论

agent 间互通信
容易陷入幻觉循环
**现成框架几乎没有**

</div>

</div>

---

## 18 分钟 · 4 个问题

| # | 问题 | 时长 | 章节 |
|---|------|------|------|
| **1** | 我做了什么？ | 2 min | 产品速览 |
| **2** | 怎么做到的？ | 5 min | Triad Workflow |
| **3** | 验证了什么？ | 3 min | 实战数据 + 教训 |
| **4** | 你能拿走什么？ | 4 min | 可复用经验 |

---

# KOLMatrix

## 全球游戏 KOL/KOC 智能营销管理平台

<div class="grid4">

<div class="card">

### Discover

KOL 发现
4 平台数据

</div>

<div class="card">

### Evaluate

engagement
评估打分

</div>

<div class="card">

### Contact

AI 个性化
邮件外联

</div>

<div class="card">

### Track

Campaign
进度跟踪

</div>

</div>

<br/>

5 国语言 (CN/EN/JA/KO/ES)　·　4 平台 (YT/TikTok/IG/X)
多租户 RLS　·　**已上线 `kol.guangai.ai`**

---

## 22 天体量数据

<div class="grid3">

<div class="num-card">
<div class="big-num">982</div>
<div class="label">commits<br/>平均 45/天</div>
</div>

<div class="num-card">
<div class="big-num">61K</div>
<div class="label">行 TypeScript<br/>473 个文件</div>
</div>

<div class="num-card">
<div class="big-num">82</div>
<div class="label">份 specs<br/>规格驱动</div>
</div>

<div class="num-card">
<div class="big-num">14</div>
<div class="label">份 ADR<br/>架构决策</div>
</div>

<div class="num-card">
<div class="big-num">103</div>
<div class="label">份验收报告<br/>全部留痕</div>
</div>

<div class="num-card">
<div class="big-num">30+</div>
<div class="label">framework 版本<br/>迭代演进</div>
</div>

</div>

> 大部分代码 / 规格 / 报告由 AI agent 生成；我的角色是设计、决策、监督

---

# Triad Workflow

## 核心思想 · 四要素

<div class="grid2">

<div class="card">

### 三角色不重叠

Planner / Generator / Evaluator
**无人评估自己的工作**
→ 解决「AI 自评失控」

</div>

<div class="card">

### 状态机驱动

7 状态硬约束
**不在你的状态就退出**
→ 解决「AI 越权失控」

</div>

<div class="card">

### Git 作协作总线

`progress.json` + `.auto-memory/`
异步交接，跨设备/工具
→ 解决「多 AI 协作无方法论」

</div>

<div class="card">

### 记忆分层

T0 / T1 / T2 确定性加载
**避免上下文塞满丢状态**
→ 解决「上下文失控」

</div>

</div>

---

## 三角色协作

```
┌──────────────┐  规格+features.json   ┌──────────────┐  代码+commits  ┌──────────────┐
│   Planner    │ ───────────────────► │  Generator   │ ─────────────► │  Evaluator   │
│ (Claude CLI) │                      │ (Claude CLI) │                │   (Codex)    │
│ 拆需求/写ADR │ ◄─────────────────── │ 实现/修复    │ ◄───────────── │ 设计测试+    │
│ 仲裁         │  done 阶段反馈       │              │ PASS/FAIL+回归 │ 验收+写报告  │
└──────────────┘                      └──────────────┘                └──────────────┘
```

> **铁律：** 测试设计权 100% 归 Evaluator · Generator 不准写自己的测试
> Planner 不准改产品代码（铁律 9：紧急 hotfix 也走流程）

---

## 状态机 · 7 状态硬约束

```
   new ──► planning ──► building ──► verifying ──► fixing ⟷ reverifying ──► done
                ↑           ↑              │           ↑              │
                │           └──────────────┘           └──────────────┘
                └─── 全 codex 任务 ───────► verifying（跳过 building）
```

**关键：** AI agent 启动第一件事就是读 `progress.json` 的 status —— 不匹配自己角色就直接退出。

不靠它「自觉」，是状态机硬不让它干。

---

## 记忆分层 + 跨设备协作

| 层 | 何时加载 | 文件 | 大小 |
|----|---------|------|------|
| **T0** | 每次启动必读 | `MEMORY.md` + `project-status.md` + `environment.md` | ≤30 行 |
| **T1** | 按当前角色加载 | `role-context/{角色}.md` | ≤50 行 |
| **T2** | 触发条件命中 | `feedback-*.md` / `reference-*.md` | 按需 |

```
┌─ 本机 A ─┐  git push   ┌── GitHub ──┐  git pull   ┌─ 本机 B ─┐
│ Claude   │ ──────────► │.auto-memory│ ──────────► │ Codex    │
│ Planner  │             │progress.json│            │ Reviewer │
└──────────┘             └────────────┘             └──────────┘
```

> 早上台式机当 Planner，下午笔记本当 Reviewer，状态完全无缝

---

## 22 天实战 KPI

<div class="grid3">

<div class="card">

### 交付密度

**982** commits / 22 天
平均 **45**/天
高峰单日 **78** commits

</div>

<div class="card">

### 验收质量

**103** 份验收报告全部留痕
**14** 份 ADR 长期决策
fix_round 极少 > 2

</div>

<div class="card">

### 时间分布

**42** 个独立批次
平均批次 4-6 小时
上线 buffer 3 天

</div>

</div>

> **关键洞察：** 框架强制 Evaluator 拥有完整测试设计权 → Generator 写代码时主动反推「这功能怎么验收」 → spec 质量被前置推高 → 后期 fix 反而减少。**严格分工 ≠ 低效**。

---

## 30+ 框架版本 = 30+ 次实战教训

| 版本 | 沉淀的规则 | 起因（真实事故） |
|------|-----------|------------------|
| v0.5.0 | 共享记忆分层 T0/T1/T2 | 上下文塞满丢状态事故 |
| v0.7.1 | Spec 起草前必 grep 实物 | 字面假设导致回归 |
| v0.9.0 | Pre-Impl Audit 模式 | Generator 开工后才发现 spec 错 |
| v0.9.4 | 铁律 #10：commit-tag 必对应 feature | Planner docs commit 误带 9 文件 WIP 入 main |
| v0.9.11 | 状态机 JSON 必 `json.load` 校验 | progress.json 缺一个 `}` 入 main |
| v0.9.18 | auth role enum 实物核查 | 字面 `'admin'` vs 真实 `'tenant_admin'` |
| v0.9.19 | External API zod schema 实物 sample | 单测 mock PASS 但 prod 50/41 row 触发 parse error |

> **诚实点：** 这些都是踩出来的，不是设计出来的

---

## 工程层 7 条经验（给工程师）

| 经验 | Why |
|------|-----|
| **设计系统先行** | 第一个批次必须是设计系统，不是业务页面。后期返工成本是前期 5x |
| **Pre-Impl Audit** | Generator 开工前主动审计 spec vs 实物 → Planner 裁决 |
| **CI 红不开新功能** | 每次 push 后必查 `gh run`，红色立即停手 |
| **Critical 修必带回归** | 修复同 commit 补 regression test，否则 bug 一定回归 |
| **单功能单 migration** | 不打包 schema 变更，回滚粒度对应风险粒度 |
| **视觉规范 ±2px / ΔE<2** | pixel-perfect 量化标准；模糊标准 = AI 输出不收敛 |
| **ADR 沉淀关键决策** | AI 长期协作需要决策"长期记忆"，本项目 14 份 |

---

## AI 协作层 5 条经验（人人受用 · 1/2）

<div class="grid3">

<div class="card">

### 1 · 不让 AI 评估自己

验收必须由不同角色 / **不同工具**完成
Generator 用 Claude，Evaluator 用 Codex
强化职责边界

</div>

<div class="card">

### 2 · 状态机 > 自觉规则

文档里写「禁止 X」= 软约束
**「不在你的状态就退出」= 硬约束**

</div>

<div class="card">

### 3 · 记忆分层 > 塞满

T0 必读 30 行 + T1 角色 50 行 + T2 触发加载
**每次启动加载越小，焦点越清晰**

</div>

</div>

---

## AI 协作层 5 条经验（人人受用 · 2/2）

<div class="grid2">

<div class="card">

### 4 · Spec 前必 grep 实物

字面假设 / mock shape / 旧记忆 = 三大盲区
**auth enum / 真数据 sample / git log** 必查
v0.9.14 后框架硬性入口检查

</div>

<div class="card">

### 5 · Git 是协作总线

`progress.json` + `.auto-memory/` 入 git
→ 跨设备 / 跨工具协作免费实现
`.agent-id` 不入 git → 本机身份隔离

</div>

</div>

<br/>

→ **Triad Workflow 已开源为 template repo**

---

<!-- _class: cover invert -->

## 一个人 + AI 不是 demo 工具

# 而是企业级生产力

### 前提：方法论 · 约束 · 沉淀

<br/>

| 产品 | 框架（可复用） |
|------|---------------|
| `kol.guangai.ai` | `tripplemay/harness-template` |
| 5 国语言 / 4 平台 / RLS | `npx degit ... && bash bootstrap.sh` |

<br/>

# Q & A
