"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { FormAlert } from "@/components/form-alert";
import type { FormState } from "@/lib/form-state";

import { createAccount, type CreateAccountField } from "./actions";
import { JoinedField, JoinedSubmit } from "./joined-field";

const initial: FormState<CreateAccountField> = { status: "idle" };

export function CreateAccountForm() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(createAccount, initial);

  return (
    <>
      <form action={action} noValidate className="flex w-full flex-col gap-3.5">
        <FormAlert message={state.formError} />
        <JoinedField
          name="displayName"
          label={t("displayName")}
          autoComplete="name"
          placeholder={t("displayNamePlaceholder")}
          defaultValue={state.values?.displayName}
          error={state.fieldErrors?.displayName}
          maxLength={100}
          required
        />
        <JoinedField
          name="email"
          label={t("email")}
          type="email"
          autoComplete="email"
          placeholder={t("emailPlaceholder")}
          defaultValue={state.values?.email}
          error={state.fieldErrors?.email}
          joined
          required
        />
        <JoinedField
          name="password"
          label={t("password")}
          type="password"
          autoComplete="new-password"
          hint={t("passwordHint")}
          error={state.fieldErrors?.password}
          minLength={12}
          maxLength={128}
          joined
          required
        />
        <JoinedSubmit label={t("createAccount.submit")} pendingLabel={t("createAccount.pending")} pending={pending} />
      </form>
      <p className="text-text-muted">
        {t("createAccount.switchPrompt")}{" "}
        <Link href="/sign-in" className="font-semibold text-accent-ink underline-offset-4 hover:underline">
          {t("createAccount.switchLink")}
        </Link>
      </p>
    </>
  );
}
