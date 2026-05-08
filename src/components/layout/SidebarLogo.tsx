/**
 * Sidebar brand block — 40x40 cyan gradient tile + wordmark.
 * Consumed only by <Sidebar />; see B0-app-shell-component.md §6.1.
 *
 * BL-055 F005: subtitle pulls from `common.brand.subtitle` so each
 * locale renders the product tagline ("Game KOL Marketing Platform"
 * / "游戏 KOL 智能营销平台" etc.) instead of the original Stitch
 * design-doc codename "Neural Velocity".
 */
import { getTranslations } from "next-intl/server";

export async function SidebarLogo() {
  const t = await getTranslations("common.brand");
  return (
    <div className="flex items-center gap-3 px-2">
      <div className="gradient-cta ai-glow flex h-10 w-10 items-center justify-center rounded-[10px]">
        <span className="text-navy-base text-lg font-bold">K</span>
      </div>
      <div className="flex flex-col leading-tight">
        <span className="gradient-text text-[18px] font-bold tracking-tight">KOLMatrix</span>
        <span className="text-on-surface-variant/70 text-[9px] font-semibold tracking-[0.15em] uppercase">
          {t("subtitle")}
        </span>
      </div>
    </div>
  );
}
