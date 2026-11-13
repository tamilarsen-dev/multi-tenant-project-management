import type { Metadata } from "next";
import localFont from "next/font/local";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import { PreferencesProvider } from "@/features/preferences/preferences-provider";
import { readPreferences } from "@/lib/server/preferences";
import { readTheme } from "@/lib/server/theme";

import "./globals.css";

/* Self-hosted (SIL OFL 1.1, licenses in src/fonts): no request to Google at build or run time. */
const bricolage = localFont({
  src: "../fonts/bricolage-grotesque-latin-wght-normal.woff2",
  variable: "--font-bricolage",
  weight: "200 800",
  display: "swap",
});

const instrumentSans = localFont({
  src: "../fonts/instrument-sans-latin-wght-normal.woff2",
  variable: "--font-instrument-sans",
  weight: "400 700",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common");
  return {
    title: { template: "%s · Detent", default: "Detent" },
    description: t("tagline"),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [locale, theme, preferences] = await Promise.all([getLocale(), readTheme(), readPreferences()]);

  return (
    <html
      lang={locale}
      data-theme={theme === "system" ? undefined : theme}
      data-motion={preferences.motion === "reduce" ? "reduce" : undefined}
      data-peg={preferences.peg ? undefined : "hidden"}
      className={`${bricolage.variable} ${instrumentSans.variable}`}
    >
      {/* Browser extensions (e.g. Grammarly) add attributes to <body> before hydration. */}
      <body className="min-h-dvh bg-bg text-text" suppressHydrationWarning>
        <NextIntlClientProvider>
          <PreferencesProvider value={preferences}>{children}</PreferencesProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
