import { getTranslations } from "next-intl/server";

import { Logo } from "@/components/logo";

export async function AuthHeading({ title, subtitle }: { title: string; subtitle: string }) {
  const t = await getTranslations("common");
  return (
    <>
      <Logo size={34} label={t("appName")} />
      <div className="text-center">
        <h1 className="mb-1.5 text-h2 font-bold sm:text-h1 short:text-h2">{title}</h1>
        <p className="text-text-muted">{subtitle}</p>
      </div>
    </>
  );
}
