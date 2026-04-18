/**
 * Sidebar brand block — 40x40 cyan gradient tile + wordmark.
 * Consumed only by <Sidebar />; see B0-app-shell-component.md §6.1.
 */
export function SidebarLogo() {
  return (
    <div className="flex items-center gap-3 px-2">
      <div className="gradient-cta ai-glow flex h-10 w-10 items-center justify-center rounded-[10px]">
        <span className="text-navy-base text-lg font-bold">K</span>
      </div>
      <div className="flex flex-col leading-tight">
        <span className="gradient-text text-[18px] font-bold tracking-tight">KOLMatrix</span>
        <span className="text-on-surface-variant/70 text-[9px] font-semibold tracking-[0.15em] uppercase">
          Neural Velocity
        </span>
      </div>
    </div>
  );
}
