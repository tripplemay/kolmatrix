import Image from "next/image";

interface SidebarUserChipProps {
  name: string;
  role: string;
  avatarUrl?: string | null;
}

export function SidebarUserChip({ name, role, avatarUrl }: SidebarUserChipProps) {
  const initial = name.trim().charAt(0).toUpperCase() || "U";
  return (
    <div className="bg-navy-700/50 mt-auto flex items-center gap-3 rounded-[14px] px-3 py-2.5">
      <div className="bg-navy-700 relative h-9 w-9 shrink-0 overflow-hidden rounded-full">
        {avatarUrl ? (
          <Image src={avatarUrl} alt="" fill sizes="36px" className="object-cover" />
        ) : (
          <div className="bg-brand-500 flex h-full w-full items-center justify-center">
            <span className="text-sm font-bold text-white">{initial}</span>
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-on-surface truncate text-[13px] font-semibold">{name}</span>
        <span className="text-on-surface-variant/70 truncate text-[11px]">{role}</span>
      </div>
      <span
        className="material-symbols-outlined text-on-surface-variant/70 text-[18px]"
        aria-hidden
      >
        expand_more
      </span>
    </div>
  );
}
