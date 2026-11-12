import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SignInForm } from "@/features/auth/sign-in-form";
import { safeNextPath } from "@/lib/session-cookie";

import { AuthHeading } from "../auth-heading";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.signIn");
  return { title: t("metaTitle") };
}

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const t = await getTranslations("auth");
  const next = safeNextPath(params.next);
  const notice = params.reason === "expired" ? t("sessionExpired") : undefined;

  return (
    <>
      <AuthHeading title={t("signIn.title")} subtitle={t("signIn.subtitle")} />
      <SignInForm next={next} notice={notice} />
    </>
  );
}
