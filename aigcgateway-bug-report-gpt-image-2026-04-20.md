# AIGC Gateway — 图片生成三通道持续失败故障报告（v3）

> **报告日期:** 2026-04-20 初版 / 2026-04-21 v2 追加 / 2026-04-21 v3 追加（第 3 次修复复测仍 fail）
> **上报方:** KOLMatrix project（同机 `~/project/aigcgateway` 姊妹项目）
> **上报人:** Planner (Kimi) · 代表用户 tripplezhou@gmail.com
> **影响:** KOLMatrix BAux1 批次 AI 图生成被阻；临时用 ByteDance seedream-3 规避（带 "AI生成" 水印，需 CSS 裁切）
> **紧急程度:** Medium-High — 4 个图片模型中 3 个全挂

---

## 0. TL;DR

**截至 2026-04-21，OpenAI/Google 两家上游全部挂，ByteDance 通道正常：**

| 模型 | 上游 | 状态 | 持续错误 |
|---|---|---|---|
| `gpt-image` | OpenAI | ❌ FAIL | "text instead of image" / "模型无返回结果" / 余额不足 |
| `gpt-image-mini` | OpenAI | ❌ FAIL | "text instead of image" |
| `gemini-3-pro-image` | Google Vertex | ❌ FAIL | "text instead of image" |
| `seedream-3` | ByteDance | ✅ OK | （对照组，正常返回图片）|

**核心症状：** 上游真跑了 API（latency 25-85s），但返回 **文字响应而非图片**。Gateway 正确识别为错误并置 `cost=$0`。问题在上游或 Gateway 的 response 解析层。

---

## 1. 时间线

| 时间（UTC） | 事件 |
|---|---|
| 2026-04-20 12:24-12:25 | 首次发现 `gpt-image` 失败（"text instead of image" + "余额不足"混合） |
| 2026-04-20 12:26 | 临时切 `seedream-3` 成功绕过 |
| 2026-04-20 晚 | 提交初版 bug report v1 |
| 2026-04-20 晚 | aigcgateway 开发组告知"两个模型已恢复"（**第 1 次修复声明**） |
| 2026-04-20 14:58-15:06 | 第 2 次复测：gpt-image / gemini-3-pro-image / gpt-image-mini 三通道全部 fail，错误一致 "text instead of image" |
| 2026-04-21 AM | 写 v2 报告（§4 给出 P0 排查：抓上游 raw response body） |
| 2026-04-21 晚（~16:55 UTC） | aigcgateway 开发组告知"已经修复错误"（**第 2 次修复声明**） |
| 2026-04-21 16:56-16:59 UTC | 第 3 次复测 `gpt-image` 1792×1024，**再次全部 fail**，同样两类错误；latency 拉长到 94-95s |
| 2026-04-21 晚 | 写本 v3 报告（新增 §2.5 第 3 次复测 trace）|

---

## 2. 完整失败 trace 列表（按时间正序）

### 2.1 gpt-image 通道（4 次失败）

#### Trace `trc_p01whyesp9ti0n7fdittgv20` （2026-04-20T12:24:28.200Z）

| 字段 | 值 |
|---|---|
| model | `gpt-image` |
| size | `1792x1024` |
| latency | `84.7s` |
| status | error |
| cost | $0 |
| **error** | `Image generation did not return a valid image. The model responded with text instead of an image.` |

Prompt（~900 字符，完整 cinematic world map 描述）见 v1 §2.1。

#### Trace `trc_du6pidudbdevosh2bgbxya4u` （2026-04-20T12:25:17.152Z）

| 字段 | 值 |
|---|---|
| model | `gpt-image` |
| size | `1792x1024` |
| latency | `67.1s` |
| status | error |
| cost | $0 |
| **error** | `账户余额过低不足以支持本次请求，请前往 [URL] 充值。Your account balance is not sufficient to support this request...（当前请求使用的 ApiKey: [redacted]）` |

Prompt: 短版本 ~280 字符。

#### Trace `trc_frjhhiay6qz8qa4pp42kxfm8` （2026-04-20T14:58:21.800Z）【"恢复后"复测】

| 字段 | 值 |
|---|---|
| model | `gpt-image` |
| size | `1792x1024` |
| latency | `69.0s` |
| status | error |
| cost | $0 |
| **error** | `Image generation did not return a valid image. The model responded with text instead of an image.` |

Prompt: 同 Trace A 的 900 字符 world map 描述（略微加长）。

#### Trace `trc_tjy1khx5a7l5nfn8bzjhaafp` （2026-04-20T14:59:59.212Z）【"恢复后"复测】

| 字段 | 值 |
|---|---|
| model | `gpt-image` |
| size | `1792x1024` |
| latency | `79.2s` |
| status | error |
| cost | $0 |
| **error** | `模型无返回结果，可能是内容违规、输入过长、输入格式有误或负载较高，请检查后再试。No response, please try again.` |

Prompt: war room operations control room 描述 ~1000 字符。

---

### 2.2 gemini-3-pro-image 通道（2 次失败）

#### Trace `trc_bephjh6qkzdar7jakiy3ndig` （2026-04-20T15:04:17.163Z）

| 字段 | 值 |
|---|---|
| model | `gemini-3-pro-image` |
| size | `1024x1024` |
| latency | `25.5s` |
| status | error |
| cost | $0 |
| **error** | `Image generation did not return a valid image. The model responded with text instead of an image.` |

Prompt: world map ~500 字符（中等长度，去掉了 gpt-image 的冗长描述）。

#### Trace `trc_go4arxk5cfvmncn5fu5lj4rs` （2026-04-20T15:05:18.262Z）【极简 prompt 测试】

| 字段 | 值 |
|---|---|
| model | `gemini-3-pro-image` |
| size | `1024x1024` |
| latency | `46.6s` |
| status | error |
| cost | $0 |
| **error** | `Image generation did not return a valid image. The model responded with text instead of an image.` |

Prompt（~100 字符，**已简化到无法再短**）：
```text
A dark blue world map with glowing cyan dots across continents, connected by light arcs, minimal and atmospheric.
```

**说明：** 这条极简 prompt 不可能命中任何 content policy，也不过长，仍失败。排除"内容违规 / 输入过长 / 格式错"三种可能，问题在上游或解析层。

---

### 2.3 gpt-image-mini 通道（1 次失败）

#### Trace `trc_f5yqu702dqctzrhnujut1zyd` （2026-04-20T15:06:32.371Z）

| 字段 | 值 |
|---|---|
| model | `gpt-image-mini` |
| size | `1536x1024` |
| latency | `61.9s` |
| status | error |
| cost | $0 |
| **error** | `Image generation did not return a valid image. The model responded with text instead of an image.` |

Prompt: 同上极简 world map prompt（~100 字符）。

---

### 2.4 seedream-3 通道（对照组，2026-04-20 早/午 2 次成功）

| traceId | size | latency | status | 说明 |
|---|---|---|---|---|
| `trc_fsyw9lu2azfa7l0uzfxpk2zh` | 1280×960 | ~20s | ✅ success | world map，内容符合预期，但右下角有 "AI生成" 水印 |
| `trc_ybbnhmc33rl6h1ev9rv6dc1c` | 1280×960 | ~25s | ✅ success | war room，内容符合预期，同水印 |

两次调用 cost 各 $0.041，图片 URL 可正常下载。证明**同时段 gateway 对 ByteDance 上游正常**，问题定位在 OpenAI + Google 两家通道。

---

### 2.5 gpt-image 通道 — 第 3 次复测（2026-04-21 UTC，第 2 次修复声明后）

**修复声明与复测间隔不足 5 分钟，两条调用全部复发。错误类型与之前一致，但 latency 明显拉长。**

#### Trace `trc_cvu84fecmi1x7owz9ip5e05z` （2026-04-20T16:56:30.678Z）

| 字段 | 值 |
|---|---|
| model | `gpt-image` |
| size | `1792x1024` |
| latency | `95.8s` ← **比 v2 的 69s 拉长 40%** |
| status | error |
| cost | $0 |
| **error** | `Image generation did not return a valid image. The model responded with text instead of an image.` |

Prompt: 同 §2.1 Trace A/C 的 world map ~900 字符描述。

#### Trace `trc_kju9fxz5rhmvilct0msin0jt` （2026-04-20T16:57:43.381Z）

| 字段 | 值 |
|---|---|
| model | `gpt-image` |
| size | `1792x1024` |
| latency | `94.4s` ← **比 v2 的 79s 拉长 20%** |
| status | error |
| cost | $0 |
| **error** | `模型无返回结果，可能是内容违规、输入过长、输入格式有误或负载较高，请检查后再试。No response, please try again.` |

Prompt: war room ~1000 字符描述（同 §2.1 Trace D）。

#### 关键观察（给开发组的 P0 信号）

1. **错误类型完全一致** — "text instead of image" + "模型无返回结果"，说明第 2 次修复没触碰到真正的 root cause
2. **Latency 从 69-79s 拉长到 94-95s** — 上游响应路径明显变了（可能加了重试 / fallback / 新的 upstream route），但最终还是返回非 image 响应
3. **两种错误精准复现** — 长 prompt → "text instead of image"；另一种 prompt → "模型无返回结果"。错误类型与 prompt 的对应关系稳定，说明 **prompt 的某种特征触发了不同的上游响应分支**，但两个分支都没产出 image
4. **其他通道状态未验证**（本次只测 gpt-image）— gemini-3-pro-image / gpt-image-mini 若开发组声明已修，需单独跑验证
5. **对比 v1 的"余额不足"错误**，第 3 次复测没再出现这条 — 说明"上游余额"问题确实解决了，但"text instead of image" 是**另一个未解 bug**


| traceId | size | latency | status | 说明 |
|---|---|---|---|---|
| `trc_fsyw9lu2azfa7l0uzfxpk2zh` | 1280×960 | ~20s | ✅ success | world map，内容符合预期，但右下角有 "AI生成" 水印 |
| `trc_ybbnhmc33rl6h1ev9rv6dc1c` | 1280×960 | ~25s | ✅ success | war room，内容符合预期，同水印 |

两次调用 cost 各 $0.041，图片 URL 可正常下载（见 `/opt/kolmatrix/public/brand/login-hero.jpg` + `signup-hero.jpg`）。

---

## 3. 观察与假设

### 3.1 核心矛盾

- **latency 25-85s** → 上游 API 真的跑了（不是 gateway 侧快速 reject）
- **cost=$0** → gateway 识别到了错误，没算费
- **"text instead of image"** 措辞一致 → 上游返回了一个文字响应（JSON error / explanation / refusal）
- **seedream-3 同时段正常** → 非 gateway 整体故障，是 OpenAI+Google 两家上游的通道问题

### 3.2 假设（按可能性排序）

1. **【最可能】上游 API 额度/配额耗尽导致返回 text error response**
   - OpenAI 和 Google 的 image generation API 配额是 project/org 级别
   - 两家同时耗尽太巧，更可能是：上游代理账户（aigcgateway 用的 upstream account）被标记 / 限流 / rate-limit
   - 建议查 aigcgateway 用的 upstream OpenAI key 和 Google Vertex service account 的账单/配额
   
2. **【可能】上游 content policy 突然收紧**
   - 2026-04 之后 OpenAI/Google 对 image generation 的内容过滤变严
   - 但"A dark blue world map"这种极简 prompt 不可能命中
   - 可以排除
   
3. **【可能】aigcgateway 的 response 解析层识别错误**
   - 上游可能返回一个带 url 的结构化 JSON，但 gateway 的解析代码预期的是 base64 或其他格式
   - 如果 OpenAI 最近改了 response schema，老的解析逻辑会把 image URL 识别成"text response"
   - 建议：抓 1 次失败调用的 upstream raw response body 看真相

4. **【不太可能】模型侧的 refuse** - 极简 prompt 不会被 refuse

---

## 4. 给开发组的排查建议（按优先级）

### 4.1 【P0】获取失败调用的上游原始 response body

上述 traceId 任选一条（推荐最近的 `trc_f5yqu702dqctzrhnujut1zyd`），从 gateway 的 request log 里把 **upstream raw response**（非解析后的 "text instead of image" 摘要）拿出来看。需要区分：

- 是 HTTP error（4xx/5xx + error body）？
- 是 HTTP 200 但 body 是 JSON refusal / quota warning？
- 是 HTTP 200 但 body 结构和以前不一样（OpenAI 改 schema）？

这一条定案后，后面 3 条自然有方向。

### 4.2 【P1】核对上游账户配额

- **OpenAI**（gpt-image / gpt-image-mini 共用）：去 platform.openai.com → Usage / Limits 看当前 image quota 是否满
- **Google Vertex**（gemini-3-pro-image）：Cloud Console → 项目 IAM & Quotas → image generation 相关 quota
- 如果是 quota 满，应该返回 `429` 或明确的 "quota_exceeded" 错误，gateway 错误信息可以更明确

### 4.3 【P1】错误信息区分"用户余额" vs "上游余额" vs "上游解析失败"

v1 报告已经提过这一点，现在 2026-04-21 复测又中招一次（`模型无返回结果...请检查后再试` 对终端用户毫无信息量）。

建议错误 taxonomy：

| 错误场景 | gateway 响应给 MCP/REST 客户端 |
|---|---|
| 用户余额不足 | `"user_balance_low"` + 充值 URL（指向 aigcgateway 充值页） |
| 上游 provider 余额不足 | `"provider_balance_low"` + 内部 on-call 告警（不对用户暴露充值 URL） |
| 上游 content policy refuse | `"provider_refused"` + refuse reason（透传上游说法） |
| 上游 quota rate-limit | `"provider_rate_limited"` + retry-after |
| 上游 response 解析失败 | `"provider_response_parse_error"` + 一条 internal ticket ID（onKalder 内部排查） |
| 上游超时 | `"provider_timeout"` + latency |
| 其他未分类 | `"provider_error_unknown"` + 完整上游 response body 给 on-call |

### 4.4 【P2】失败自动 fallback

如果某模型 channel 连续 N 次失败（N=3？），gateway 可以：
- 标记该 channel 为 degraded
- 客户端下次 call 时自动路由到相同 modality 的备用 model（gpt-image → seedream-3 / gemini → ...）
- response meta 带 `fallback_reason: "gpt-image channel degraded since 2026-04-20T15:XX"`
- 让集成方（如 KOLMatrix）不用每次手动换 model

---

## 5. 复现最小 case

```bash
# 任意 aigcgateway 用户 API Key 都可
curl -X POST https://aigc.guangai.ai/v1/images/generations \
  -H "Authorization: Bearer pk_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-3-pro-image",
    "prompt": "A dark blue world map with glowing cyan dots across continents, connected by light arcs, minimal and atmospheric.",
    "size": "1024x1024"
  }'
```

**预期:** HTTP 200 + image URL
**实际（2026-04-21 最后测试）:** 30-90s 后 5xx / error body 含 `"Image generation did not return a valid image. The model responded with text instead of an image."`

---

## 6. KOLMatrix 侧临时方案

- 已用 `seedream-3` 生成两张 hero 图（login-hero.jpg + signup-hero.jpg，1280×960），入库 `public/brand/`
- 水印处理：CSS `object-fit: cover` + 裁掉底部 ~60px 水印带（1280×900 最终显示区）
- 若 gpt-image 或 gemini-3-pro-image 通道恢复，后续批次（V6+）优先回这两个（无水印 + 支持 16:9 宽屏）

---

## 7. 联系方式

- 项目：KOLMatrix（姊妹项目，同机部署 `/opt/kolmatrix`）
- 上报人：tripplezhou@gmail.com
- 期望结果：
  - 上游 raw response body 对比分析（§4.1）
  - 错误 taxonomy 重构（§4.3）
  - 失败自动 fallback（§4.4）

**上报日期 v1:** 2026-04-20
**v2 更新:** 2026-04-21（追加 3 通道复测数据）
**v3 更新:** 2026-04-21 晚（追加第 3 次复测 — 第 2 次修复声明后 5 分钟内复发同两种错误，latency 拉长 20-40%；新 traceId `trc_cvu84fec...` + `trc_kju9fxz5...` 供开发组对比分析）
