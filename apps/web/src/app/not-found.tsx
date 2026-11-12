import { getTranslations } from "next-intl/server";

import { ButtonLink } from "@/components/button";

export default async function NotFound() {
  const t = await getTranslations("errors.notFound");
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="text-h2 font-bold">{t("title")}</h1>
      <p className="text-text-muted">{t("body")}</p>
      <ButtonLink href="/workspaces" variant="secondary">
        {t("home")}
      </ButtonLink>
    </div>
  );
}
