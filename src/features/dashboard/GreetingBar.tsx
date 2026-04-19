/**
 * GreetingBar — Dashboard 区块 1（问候栏 + New Campaign CTA）
 *
 * 抽出帮 page.tsx 压 JSX ≤80 行（Kimi F007 §11.2 硬约束）。
 * 名字来自 session.user.name（F006 #F5:A 动态）。
 */
import { getTranslations } from "next-intl/server";

import { GradientButton } from "@/components/common";

interface Props {
  name: string;
  dateLabel: string;
}

export async function GreetingBar({ name, dateLabel }: Props) {
  const t = await getTranslations("dashboard");
  return (
    <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
      <div>
        <h2 className="text-on-surface mb-2 text-4xl font-extrabold tracking-[-0.02em] md:text-5xl">
          {t("greeting", { name })}
        </h2>
        <p className="text-on-surface-variant md:text-lg">
          {t("subtitle", { date: dateLabel })}
        </p>
      </div>
      <GradientButton
        size="lg"
        icon={
          <span className="material-symbols-outlined text-[20px]" aria-hidden>
            add
          </span>
        }
      >
        {t("newCampaign")}
      </GradientButton>
    </div>
  );
}
