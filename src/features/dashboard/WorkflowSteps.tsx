"use client";

import { useTranslations } from "next-intl";

import { GlassPanel } from "@/components/common";

interface StepDef {
  icon: string;
  titleKey: string;
  done: boolean;
}

interface Props {
  productCount: number;
  kolCount: number;
  campaignTotal: number;
  emailTotal: number;
  revenueCount: number;
  roiDataCount: number;
}

export function WorkflowSteps({
  productCount,
  kolCount,
  campaignTotal,
  emailTotal,
  revenueCount,
  roiDataCount,
}: Props) {
  const t = useTranslations("dashboard.workflow");

  const steps: StepDef[] = [
    { icon: "package_2", titleKey: "addProduct", done: productCount > 0 },
    { icon: "manage_search", titleKey: "findKol", done: kolCount > 0 },
    { icon: "campaign", titleKey: "createCampaign", done: campaignTotal > 0 },
    { icon: "mail", titleKey: "sendEmails", done: emailTotal > 0 },
    { icon: "payments", titleKey: "recordRevenue", done: revenueCount > 0 },
    { icon: "trending_up", titleKey: "viewRoi", done: roiDataCount > 0 },
  ];

  return (
    <GlassPanel padding="md" rounded="2xl" tone="neutral" data-testid="dashboard-workflow-steps">
      <h3 className="text-on-surface-variant font-poppins mb-4 text-sm font-semibold tracking-widest uppercase">
        {t("title")}
      </h3>
      {/* overflow-x-auto keeps the row scrollable on small screens */}
      <div className="overflow-x-auto">
        <div className="flex min-w-[480px] items-start">
          {steps.map((step, i) => (
            <div key={step.titleKey} className="flex flex-1 flex-col items-center">
              {/* connector row */}
              <div className="flex w-full items-center">
                {/* left connector */}
                <div
                  className={`h-[2px] flex-1 ${i === 0 ? "invisible" : step.done ? "bg-brand-500/60" : "bg-white/10"}`}
                />
                {/* circle */}
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                    step.done
                      ? "border-brand-500 bg-brand-500/15 text-brand-400"
                      : "bg-navy-700 text-on-surface-variant border-white/20"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">{step.icon}</span>
                </div>
                {/* right connector */}
                <div
                  className={`h-[2px] flex-1 ${i === steps.length - 1 ? "invisible" : step.done ? "bg-brand-500/60" : "bg-white/10"}`}
                />
              </div>
              {/* label */}
              <p
                className={`mt-2 text-center text-[11px] leading-tight font-medium ${
                  step.done ? "text-white" : "text-on-surface-variant"
                }`}
              >
                {t(step.titleKey)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </GlassPanel>
  );
}
