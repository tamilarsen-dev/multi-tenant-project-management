"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { FormAlert } from "@/components/form-alert";

import { signIn, type AuthFormState, type SignInField } from "./actions";
import { JoinedField, JoinedSubmit, useStageSignals } from "./joined-field";

const initial: AuthFormState<SignInField> = { status: "idle" };

export function SignInForm({ next, notice }: { next: string; notice?: string }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(signIn, initial);
  useStageSignals(pending, state, "signin");

  return (
    <>
      <form action={action} noValidate className="flex w-full flex-col gap-3.5">
        <input type="hidden" name="next" value={next} />
        <FormAlert message={state.formError ?? (state.status === "idle" ? notice : undefined)} />
        <JoinedField
          name="email"
          stageField="email"
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
          stageField="password"
          revealable
          joined
          label={t("password")}
          type="password"
          autoComplete="current-password"
          error={state.fieldErrors?.password}
          required
        />
        <JoinedSubmit label={t("signIn.submit")} pendingLabel={t("signIn.pending")} pending={pending || state.status === "success"} />
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
