/**
 * BL-065-F003 · /admin/kol-csv-import — admin-only CSV bulk import.
 *
 * Spec §F003 decision-point #C Planner-tilt = "本批次仅起一个
 * /admin/kol-csv-import 子路由，未来 admin 功能扩展时建一个 /admin
 * 索引页 — 留 BL-070 evaluate". So this is the second admin sub-route
 * (alongside /admin/apify-preview from BL-012-F006a); the role-guard
 * pattern mirrors that page line-for-line.
 *
 * Why move ImportCsvDialog here at all: BL-065 reframes /match as the
 * marketer-facing workbench. Bulk CSV ingestion is an admin operation
 * (per spec §1 — marketers shouldn't be casually loading thousands of
 * KOL rows), so the trigger lives outside the workbench surface. The
 * dialog component physically relocated from /database via `git mv`
 * in this same commit so /admin owns the file F006 won't delete.
 */
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { isAdminRole } from "@/lib/auth/roles";

import { ImportCsvDialog } from "./ImportCsvDialog";

export const metadata = { title: "Import KOL CSV (admin) — KOLMatrix" };

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function KolCsvImportPage({ params }: Props) {
  const { locale } = await params;

  const session = await auth();
  if (!session?.user) {
    redirect(`/${locale}/login`);
  }
  if (!isAdminRole(session.user.role)) {
    redirect(`/${locale}/match`);
  }

  const t = await getTranslations("admin.kolCsvImport");
  const tImport = await getTranslations("database.import");
  const tHeader = await getTranslations("database.header");

  return (
    <div
      className="mx-auto max-w-3xl space-y-6 pb-16 pt-6"
      data-testid="admin-kol-csv-import-page"
    >
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-cyan">
          {t("eyebrow")}
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          {t("title")}
        </h1>
        <p className="max-w-2xl text-sm text-on-surface-variant">
          {t("description")}
        </p>
      </header>

      <section className="glass-panel rounded-2xl border border-on-surface/5 p-6">
        <h2 className="mb-3 text-sm font-semibold text-white">
          {t("uploadHeading")}
        </h2>
        <p className="mb-4 text-xs text-on-surface-variant">
          {t("uploadBody")}
        </p>
        {/* BL-065-R1 — successTemplate + rowErrorTemplate contain
            `{imported}` / `{skipped}` / `{row}` / `{message}` tokens
            that the client-side dialog substitutes via String.replace
            (not next-intl ICU). Calling `tImport("…")` evaluates them
            as ICU placeholders and throws FORMATTING_ERROR on server-
            side render (latent bug exposed when F003 mounted this
            dialog on a route that actually renders, vs the old
            /database that 302'd away). `.raw(key)` bypasses ICU
            evaluation and returns the literal template string. */}
        <ImportCsvDialog
          triggerLabel={tHeader("import")}
          triggerTitle={tHeader("importTooltip")}
          dialogTitle={tImport("title")}
          dialogBody={tImport("body")}
          uploadLabel={tImport("uploadLabel")}
          uploadingLabel={tImport("uploadingLabel")}
          cancelLabel={tImport("cancelLabel")}
          successTemplate={tImport.raw("successTemplate") as string}
          errorLabel={tImport("errorLabel")}
          rateLimitLabel={tImport("rateLimitLabel")}
          fileTooLargeLabel={tImport("fileTooLargeLabel")}
          rowErrorTemplate={tImport.raw("rowErrorTemplate") as string}
        />
      </section>

      <p className="text-xs text-on-surface-variant">
        <Link
          href={`/${locale}/match`}
          className="text-cyan hover:underline"
          data-testid="admin-kol-csv-import-back"
        >
          ← {t("backToMatch")}
        </Link>
      </p>
    </div>
  );
}
