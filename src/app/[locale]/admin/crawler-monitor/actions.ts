"use server";

/**
 * BL-108-F003 · 爬虫暂停开关 Server Action(PATCH 代理)。
 *
 * 监控页两个 toggle(F004)调用此 action 翻 service_settings 开关:
 * admin 鉴权 → patchCrawlerState 代理爬虫 /admin/crawler-state →
 * event_log 审计(谁翻的 + 目标态)→ 返回爬虫确认后的最新状态。
 *
 * 错误语义:爬虫不可达/拒绝 → { ok:false, error } 给 UI 回滚乐观态,
 * 绝不抛(监控页不 500)。
 */
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { CrawlerMonitorError } from "@/lib/admin/crawler-monitor-client";
import {
  patchCrawlerState,
  type CrawlerState,
} from "@/lib/admin/crawler-state-client";
import { isAdminRole } from "@/lib/auth/roles";
import { logEvent } from "@/lib/events/log";

export type SetCrawlerStateResult =
  | { ok: true; state: CrawlerState }
  | { ok: false; error: "unauthorized" | "invalid_input" | CrawlerMonitorError["kind"] };

export async function setCrawlerStateAction(patch: {
  scrapingEnabled?: boolean;
  refreshEnabled?: boolean;
}): Promise<SetCrawlerStateResult> {
  const session = await auth();
  if (!session?.user || !isAdminRole(session.user.role)) {
    return { ok: false, error: "unauthorized" };
  }

  const flags: { scrapingEnabled?: boolean; refreshEnabled?: boolean } = {};
  if (typeof patch?.scrapingEnabled === "boolean") flags.scrapingEnabled = patch.scrapingEnabled;
  if (typeof patch?.refreshEnabled === "boolean") flags.refreshEnabled = patch.refreshEnabled;
  if (flags.scrapingEnabled === undefined && flags.refreshEnabled === undefined) {
    return { ok: false, error: "invalid_input" };
  }

  // `||` 而非 `??`:空串 email 也要落到 fallback;slice 对齐爬虫 zod max(200)
  const updatedBy = (session.user.email || session.user.id || "kolmatrix-admin").slice(0, 200);

  try {
    const state = await patchCrawlerState({ ...flags, updatedBy });

    // 审计:谁翻的 + 目标态(ADR-019;event_log 即 kolmatrix 侧 audit 通道)
    void logEvent({
      type: "crawler.state_toggled",
      tenantId: session.user.tenantId ?? undefined,
      actorId: session.user.id ?? undefined,
      payload: { ...flags, updatedBy, resultState: state },
    });

    revalidatePath("/[locale]/admin/crawler-monitor", "page");
    return { ok: true, state };
  } catch (err) {
    const kind = err instanceof CrawlerMonitorError ? err.kind : "transient";
    return { ok: false, error: kind };
  }
}
