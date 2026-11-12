import { getTranslations } from "next-intl/server";

import { Logo } from "@/components/logo";

export async function AuthHeading({ title, subtitle }: { title: string; subtitle: string }) {
  const t = await getTranslations("common");
  return (
    <>
      <Logo size={44} label={t("appName")} />
      <div className="text-center">
        <h1 className="mb-2 text-[40px] leading-[1.1] font-bold">{title}</h1>
        <p className="text-text-muted">{subtitle}</p>
      </div>
    </>
  );
}
