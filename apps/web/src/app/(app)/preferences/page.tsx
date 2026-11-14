import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PreferencesForm } from "@/features/preferences/preferences-form";
import { readPreferences } from "@/lib/server/preferences";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("preferences");
  return { title: t("metaTitle") };
}

export default async function PreferencesPage() {
  const [t, preferences] = await Promise.all([getTranslations("preferences"), readPreferences()]);
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-h1 font-bold">{t("title")}</h1>
        <p className="text-text-muted">{t("subtitle")}</p>
      </div>
      <PreferencesForm initial={preferences} />
    </div>
  );
}
