/**
 * RecentActivityCard — 包 5 条 ActivityFeedItem 的面板
 *
 * F007 区块 5 右栏下半部。
 */
import { ActivityFeedItem, GlassPanel, SectionHeader } from "@/components/common";

import type { ActivityItem } from "./mocks";

interface Props {
  items: ActivityItem[];
}

export function RecentActivityCard({ items }: Props) {
  return (
    <GlassPanel padding="md" rounded="2xl" tone="neutral">
      <SectionHeader title="Recent Activity" as="h3" className="mb-4" />
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
    </GlassPanel>
  );
}
