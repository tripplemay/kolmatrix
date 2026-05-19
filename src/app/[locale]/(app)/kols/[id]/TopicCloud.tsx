/**
 * B5-F006 · KOL detail page topic-cloud panel.
 *
 * Server component that:
 *   1. invokes `loadTopicCloud()` (cache-first, lazy 7-day TTL via
 *      aigcgateway Action `kol-topic-extract`).
 *   2. renders the GlassPanel + i18n title shell on the server.
 *   3. hands the keywords off to <TopicCloudClient/>, a client
 *      shim that lazy-loads the @visx/wordcloud canvas behind a
 *      `next/dynamic({ ssr: false })` boundary so the visx +
 *      d3-cloud bundle never lands on other pages or SSR.
 *
 * Empty / failure states (no titles, missing env, AI error) collapse
 * to the i18n empty copy — never a console error, never a blank box.
 */
import { getTranslations } from "next-intl/server";

import { GlassPanel } from "@/components/common";
import { loadTopicCloud, type TopicKeyword } from "@/lib/kol-detail/topic-cloud";

import { TopicCloudClient } from "./TopicCloudClient";

interface Props {
  tenantId: string;
  kolId: string;
  platform: string;
  metadata: unknown;
  recentVideoTitles: string[];
}

export async function TopicCloud(props: Props) {
  const t = await getTranslations("kolProfile.topicCloud");

  // Mirror RecentVideosGrid: only meaningful for YouTube-sourced KOLs
  // (the recent-videos input pipeline is YouTube-only). Quietly render
  // nothing for other platforms to avoid an empty placeholder.
  if (props.platform !== "youtube") return null;

  const keywords: TopicKeyword[] | null = await loadTopicCloud({
    tenantId: props.tenantId,
    kolId: props.kolId,
    titles: props.recentVideoTitles,
    metadata: props.metadata,
    // BL-070-F002: apiKey + baseUrl env vars are now read inside
    // `runAigcAction`; only the action id is plumbed through.
    actionId: process.env.AIGCGATEWAY_KOL_TOPIC_ACTION_ID,
  });

  return (
    <GlassPanel
      className="border-on-surface/5 rounded-2xl border p-6"
      data-testid="kol-topic-cloud"
    >
      <h2 className="text-cyan-fixed mb-4 text-sm font-semibold tracking-wider uppercase">
        {t("title")}
      </h2>
      {keywords && keywords.length > 0 ? (
        <TopicCloudClient keywords={keywords} />
      ) : (
        <p className="text-on-surface-variant/70 text-xs" data-testid="kol-topic-cloud-empty">
          {t("empty")}
        </p>
      )}
    </GlassPanel>
  );
}
