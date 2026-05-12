/**
 * BL-065-F002 · Inline column-search bar for the /match table view.
 *
 * Spec §F002 acceptance: "SearchBar 保留（继承 Discovery logic），表格
 * 视图下加 inline column search". The page-level SearchBar above the
 * grid handles both views; this component is the dense table-flavoured
 * search input that sits inside the table header, styled flush with
 * the rows so it feels like a column-level filter rather than a second
 * global search.
 *
 * URL-driven GET form that submits to `basePath?search=…` plus the
 * hidden `view=table` so the user stays in table view after applying.
 * No client state.
 */
import { getTranslations } from "next-intl/server";

import { Input } from "@/components/ui";

interface Props {
  basePath: string;
  /** Current search value, mirrored back to the input. */
  search: string;
}

export async function MatchTableSearch({ basePath, search }: Props) {
  const t = await getTranslations("discovery.filters");

  return (
    <form
      action={basePath}
      method="get"
      role="search"
      data-testid="match-table-search"
      className="glass-panel border-on-surface/5 flex items-center gap-2 rounded-xl border px-3 py-2"
    >
      <span
        className="material-symbols-outlined text-on-surface-variant text-[18px]"
        aria-hidden
      >
        search
      </span>
      <Input
        type="search"
        name="search"
        defaultValue={search}
        placeholder={t("searchPlaceholder")}
        maxLength={200}
        className="h-9 flex-1 border-0 bg-transparent text-sm focus:ring-0"
        data-testid="match-table-search-input"
      />
      <input type="hidden" name="view" value="table" />
      <button type="submit" className="sr-only">
        {t("apply")}
      </button>
    </form>
  );
}
