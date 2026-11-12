"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/button";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors.page");
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 text-center">
      <h1 className="text-h2 font-bold">{t("title")}</h1>
      <p className="text-text-muted">{t("body")}</p>
      <Button variant="secondary" onClick={reset}>
        {t("retry")}
      </Button>
    </div>
  );
}
