import { getTranslations } from "next-intl/server";

import { StageMark } from "@/components/logo";

/** Shared auth layout (design system §10): one centred 400 px column, decorative mark, tagline. */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("common");
  return (
    <div className="stage relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-12">
      <StageMark />
      <p className="absolute bottom-10 left-12 hidden font-display text-body-lg font-semibold text-text-muted lg:block">
        {t("tagline")}
      </p>
      <main className="relative flex w-full max-w-[400px] flex-col items-center gap-7">{children}</main>
    </div>
  );
}
