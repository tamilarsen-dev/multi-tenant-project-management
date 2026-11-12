"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { FormAlert } from "@/components/form-alert";
import type { FormState } from "@/lib/form-state";

import { signIn, type SignInField } from "./actions";
import { JoinedField, JoinedSubmit } from "./joined-field";

const initial: FormState<SignInField> = { status: "idle" };

export function SignInForm({ next, notice }: { next: string; notice?: string }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(signIn, initial);

  return (
    <>
      <form action={action} noValidate className="flex w-full flex-col gap-3.5">
        <input type="hidden" name="next" value={next} />
        <FormAlert message={state.formError ?? (state.status === "idle" ? notice : undefined)} />
        <JoinedField
          name="email"
          label={t("email")}
          type="email"
          autoComplete="email"
          placeholder={t("emailPlaceholder")}
          defaultValue={state.values?.email}
          error={state.fieldErrors?.email}
          required
        />
        <JoinedField
          name="password"
          label={t("password")}
          type="password"
          autoComplete="current-password"
          error={state.fieldErrors?.password}
          joined
          required
        />
        <JoinedSubmit label={t("signIn.submit")} pendingLabel={t("signIn.pending")} pending={pending} />
      </form>
      <p className="text-text-muted">
        {t("signIn.switchPrompt")}{" "}
        <Link href="/create-account" className="font-semibold text-accent-ink underline-offset-4 hover:underline">
          {t("signIn.switchLink")}
        </Link>
      </p>
    </>
  );
}
