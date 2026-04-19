/**
 * ActiveCampaignsSection — Dashboard 区块 3（3 行 CampaignRow + SectionHeader）
 *
 * 抽出帮 page.tsx 压 JSX ≤80 行。消费 F010: CampaignRow / GhostButton /
 * SectionHeader（三者在渲染树出现即满足 F007 §11.2 import 图口径）。
 */
import { getTranslations } from "next-intl/server";

import { CampaignRow, GhostButton, SectionHeader } from "@/components/common";

import type { DashboardCampaign } from "@/app/[locale]/(app)/dashboard/data";

interface Props {
  campaigns: DashboardCampaign[];
}

export async function ActiveCampaignsSection({ campaigns }: Props) {
  const t = await getTranslations("dashboard");
  const tCommon = await getTranslations("common");
  return (
    <section>
      <SectionHeader
        title={t("activeCampaigns")}
        as="h2"
        actions={
          <GhostButton
            icon={
              <span className="material-symbols-outlined text-[16px]" aria-hidden>
                arrow_forward
              </span>
            }
          >
            {t("viewAll")}
          </GhostButton>
        }
      />
      <div className="flex flex-col gap-4">
        {campaigns.map((c) => (
          <CampaignRow
            key={c.id}
            name={c.name}
            subtitle={c.subtitle}
            progress={c.progress}
            primaryMetric={{ label: tCommon("openRate"), value: c.openRate }}
            status={c.status}
          />
        ))}
      </div>
    </section>
  );
}
