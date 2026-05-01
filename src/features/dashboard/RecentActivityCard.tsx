/**
 * RecentActivityCard — 包 5 条 ActivityFeedItem 的面板
 *
 * F007 区块 5 右栏下半部。
 */
"use client";

import { useTranslations } from "next-intl";

import type { ActivityItem } from "@/lib/dashboard/recent-activity";

import { ActivityFeedItem, GlassPanel, SectionHeader } from "@/components/common";

interface Props {
  items: ActivityItem[];
}

export function RecentActivityCard({ items }: Props) {
  const t = useTranslations("dashboard");
  return (
    <GlassPanel padding="md" rounded="2xl" tone="neutral">
      <SectionHeader title={t("recentActivity")} as="h3" className="mb-4" />
      {items.length === 0 ? (
        <p className="text-on-surface-variant py-8 text-center text-xs">
          {t("recentActivityEmpty")}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((a) => (
            <ActivityFeedItem
              key={a.id}
              text={a.text}
              time={a.time}
              icon={a.icon}
              accent={a.accent}
            />
          ))}
        </div>
      )}
    </GlassPanel>
  );
}
