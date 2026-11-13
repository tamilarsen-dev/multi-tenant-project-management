import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { AppPeg } from "@/components/app/app-peg";
import { ThemeMenu } from "@/components/app/theme-menu";
import { Logo } from "@/components/logo";
import { signOut } from "@/features/auth/actions";
import { getCurrentUser } from "@/lib/server/auth";
import { readTheme } from "@/lib/server/theme";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, theme, t, common] = await Promise.all([
    getCurrentUser(),
    readTheme(),
    getTranslations("nav"),
    getTranslations("common"),
  ]);

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only rounded-control bg-accent px-4 py-2 text-on-accent focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-10"
      >
        {common("skipToContent")}
      </a>
      <header className="relative z-10 border-b border-border bg-surface">
        <div className="relative mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <Link href="/workspaces" aria-label={t("workspaces")} className="rounded-control">
            <Logo size={28} label={common("appName")} />
          </Link>
          <div className="flex flex-wrap items-center gap-4">
            <ThemeMenu current={theme} />
            <span className="hidden text-label text-text-muted sm:inline">{t("signedInAs", { name: user.displayName })}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="min-h-11 rounded-control px-3 text-label font-semibold text-text hover:bg-surface-sunken"
              >
                {t("signOut")}
              </button>
            </form>
          </div>
          <AppPeg name={user.displayName} />
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        {children}
      </main>
    </div>
  );
}
