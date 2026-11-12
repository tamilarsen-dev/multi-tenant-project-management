import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CreateAccountForm } from "@/features/auth/create-account-form";

import { AuthHeading } from "../auth-heading";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.createAccount");
  return { title: t("metaTitle") };
}

export default async function CreateAccountPage() {
  const t = await getTranslations("auth.createAccount");
  return (
    <>
      <AuthHeading title={t("title")} subtitle={t("subtitle")} />
      <CreateAccountForm />
    </>
  );
}
