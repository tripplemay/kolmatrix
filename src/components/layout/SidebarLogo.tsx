/**
 * Sidebar brand block — 40x40 brand-purple tile + wordmark (BL-HORIZON-FE-PILOT).
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
      <div className="bg-brand-500 shadow-hz-card flex h-10 w-10 items-center justify-center rounded-[14px]">
        <span className="font-poppins text-lg font-bold text-white">K</span>
      </div>
      <div className="flex flex-col leading-tight">
        <span className="font-poppins text-[18px] font-bold tracking-tight text-white">KOLMatrix</span>
        <span className="text-on-surface-variant/70 text-[9px] font-semibold tracking-[0.15em] uppercase">
          {t("subtitle")}
        </span>
      </div>
    </div>
  );
}
