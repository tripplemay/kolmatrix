/**
 * EmailPerformanceCard — 包 recharts chart 的面板外壳（F010 GlassPanel 消费者）
 *
 * 把 GlassPanel + SectionHeader + chart 组合在一起，给 page.tsx 节省行数。
 */
import { GlassPanel, SectionHeader } from "@/components/common";

import { EmailPerformanceChart } from "./EmailPerformanceChart";
import type { EmailPerfPoint } from "./mocks";

interface Props {
  data: EmailPerfPoint[];
}

export function EmailPerformanceCard({ data }: Props) {
  return (
    <GlassPanel padding="md" rounded="2xl" tone="neutral">
      <SectionHeader title="Email Performance" as="h3" className="mb-3" />
      <EmailPerformanceChart data={data} />
    </GlassPanel>
  );
}
