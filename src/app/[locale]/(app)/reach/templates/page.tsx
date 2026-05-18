import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { loadOutreachComposerData } from "@/lib/email/composer-data";

import { OutreachTabs } from "../OutreachTabs";
import { TemplateWorkspaceClient } from "./TemplateWorkspaceClient";

export const metadata = { title: "Email Template Editor — KOLMatrix" };

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function asScalar(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function OutreachTemplatesPage({
  params,
  searchParams,
}: Props) {
  const { locale } = await params;
  const raw = await searchParams;
  const campaignId = asScalar(raw.campaignId) ?? null;

  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) {
    redirect("/login");
  }

  const composerLocale: "en" | "zh" = locale === "zh" ? "zh" : "en";
  const composerData = await loadOutreachComposerData(
    tenantId,
    campaignId,
    composerLocale
  );

  const t = await getTranslations("outreach");
  const tTemplates = await getTranslations("outreach.templateLibrary");

  const labels = {
    title: tTemplates("title"),
    subtitle: tTemplates("subtitle"),
    breadcrumbRoot: tTemplates("breadcrumbRoot"),
    breadcrumbSection: tTemplates("breadcrumbSection"),
    draft: tTemplates("draft"),
    systemTemplates: tTemplates("systemTemplates"),
    myTemplates: tTemplates("myTemplates"),
    searchPlaceholder: tTemplates("searchPlaceholder"),
    localeAll: tTemplates("localeAll"),
    localeEn: tTemplates("localeEn"),
    localeZh: tTemplates("localeZh"),
    templateLabel: tTemplates("templateLabel"),
    templatePlaceholder: tTemplates("templatePlaceholder"),
    newTemplate: tTemplates("newTemplate"),
    saveTemplate: tTemplates("saveTemplate"),
    saveTemplateAs: tTemplates("saveTemplateAs"),
    duplicateTemplate: tTemplates("duplicateTemplate"),
    deleteTemplate: tTemplates("deleteTemplate"),
    previewTitle: tTemplates("previewTitle"),
    previewSubject: tTemplates("previewSubject"),
    previewBody: tTemplates("previewBody"),
    subjectLabel: tTemplates("subjectLabel"),
    bodyLabel: tTemplates("bodyLabel"),
    nameLabel: tTemplates("nameLabel"),
    aiButton: tTemplates("aiButton"),
    aiPending: tTemplates("aiPending"),
    aiTitle: tTemplates("aiTitle"),
    aiOriginal: tTemplates("aiOriginal"),
    aiRewritten: tTemplates("aiRewritten"),
    aiRestore: tTemplates("aiRestore"),
    aiUse: tTemplates("aiUse"),
    aiSave: tTemplates("aiSave"),
    aiClose: tTemplates("aiClose"),
    aiSavePending: tTemplates("aiSavePending"),
    aiSaveError: tTemplates("aiSaveError"),
    actionSaved: tTemplates("actionSaved"),
    actionDeleted: tTemplates("actionDeleted"),
    actionDuplicated: tTemplates("actionDuplicated"),
    errorLabels: {
      unauthorized: t("errors.unauthorized"),
      invalid_input: t("errors.invalidInput"),
      not_found: t("errors.notFound"),
      db_error: t("errors.dbError"),
      generic: t("errors.generic"),
      timeout: t("errors.aiTimeout"),
      missing_env: t("errors.missingEnv"),
      http_error: t("errors.aiHttpError"),
      invalid_response: t("errors.aiInvalidResponse"),
      email_invalid: t("errors.emailInvalid"),
    },
  };

  return (
    <div
      className="mx-auto flex max-w-[1600px] flex-col gap-6 pb-16"
      data-testid="outreach-template-library"
    >
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {t("title")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">
            {tTemplates("subtitle")}
          </p>
        </div>
      </header>

      <OutreachTabs locale={locale} activeTab="templates" />

      <TemplateWorkspaceClient
        data={composerData}
        locale={locale}
        labels={labels}
      />
    </div>
  );
}
