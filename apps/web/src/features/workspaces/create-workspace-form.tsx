"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { ButtonLink } from "@/components/button";
import { FormAlert } from "@/components/form-alert";
import { SubmitButton } from "@/components/submit-button";
import { TextField } from "@/components/text-field";
import type { FormState } from "@/lib/form-state";

import { createWorkspace, type WorkspaceField } from "./actions";

const initial: FormState<WorkspaceField> = { status: "idle" };

export function CreateWorkspaceForm() {
  const t = useTranslations("workspaces.new");
  const [state, action] = useActionState(createWorkspace, initial);

  return (
    <form action={action} noValidate className="flex flex-col gap-5">
      <FormAlert message={state.formError} />
      <TextField
        name="name"
        label={t("name")}
        placeholder={t("namePlaceholder")}
        defaultValue={state.values?.name}
        error={state.fieldErrors?.name}
        maxLength={100}
        autoComplete="off"
        required
        autoFocus
      />
      <div className="flex flex-wrap gap-3">
        <SubmitButton label={t("submit")} pendingLabel={t("pending")} />
        <ButtonLink href="/workspaces" variant="ghost">
          {t("cancel")}
        </ButtonLink>
      </div>
    </form>
  );
}
