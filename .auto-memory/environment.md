---
name: environment
description: 生产/Staging 环境地址、服务器配置、测试账号（很少变）
type: reference
---

## 生产环境

- 控制台：`https://kol.guangai.ai`
- API：`https://kol.guangai.ai/api/v1/`
- Stitch 视觉基调基准项目（Neural Velocity，已定稿 2026-04-18）：`9338165817879839093`
  - URL: https://stitch.withgoogle.com/projects/9338165817879839093
  - 设计系统 Asset: `18406648320972948834`（已含 canonical App Shell 强制规范）
  - Dashboard 屏幕（canonical shell）: `8b4aa02ae47c4da181239399c6ef4658`
  - KOL Discovery 屏幕: `a1771401c71140e49e20ebc559782dc3`
  - KOL Detail 屏幕: `b06528d25565440c833a7f94035feead`
- Stitch 早期探索项目（已淘汰）：`5540715662009406892`（scratch screens，不作参考）
- 视觉规范完整文档：`design-draft/design-system.md` + `docs/specs/visual-baseline.md`

## 生产服务器（与 aigcgateway 共机）

| 项目 | 值 |
|---|---|
| 机型 | e2-highmem-2（2 vCPU，16GB RAM） |
| 地区 | asia-northeast1-b（东京） |
| 外网 IP | `34.180.93.185` |
| SSH | `ssh tripplezhou@34.180.93.185` |
| 部署路径 | `/opt/kolmatrix` |
| 启动 | PM2（app 名 `kolmatrix`，监听 localhost:3001） |
| Nginx | `kol.guangai.ai` → `localhost:3001` |
| Postgres | 共用实例，database `kolmatrix_prod` |
| Redis | 共用实例，db index `1`（aigcgateway 用 0） |
| CI/CD | GitHub Actions → SSH → `git pull + npm ci + build + pm2 restart kolmatrix` |

## 扩容信号

- RAM 接近 14GB、CPU 持续 >70%、或 KOL 采集 worker 影响 aigcgateway 响应时，拆独立 VM。

## 测试账号

- **Admin:** `admin@kolmatrix.local` / `KOLM@2026!` / API Key: `TBD`
- **Marketer:** `marketer@kolmatrix.local` / `KOLM@2026!` / API Key: `TBD`

<!-- 写入规则：由 Planner 统一维护，环境变更后及时更新。账号密码避免明文，必要时引用 secret manager。 -->
