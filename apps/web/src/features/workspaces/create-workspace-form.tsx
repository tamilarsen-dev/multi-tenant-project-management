"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { ButtonLink } from "@/components/button";
import { FormAlert } from "@/components/form-alert";
import { SubmitButton } from "@/components/submit-button";
import { TextField } from "@/components/text-field";

import { usePeg } from "@/features/peg/peg-provider";

import { createWorkspace, type CreateState } from "./actions";

const initial: CreateState = { status: "idle" };

export function CreateWorkspaceForm() {
  const t = useTranslations("workspaces.new");
  const [state, action] = useActionState(createWorkspace, initial);
  const peg = usePeg();
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success" && state.redirectTo) {
      if (peg) peg.navigate(state.redirectTo, "create");
      else router.push(state.redirectTo);
    } else if (state.status === "error" && state.formError) {
      void peg?.play("error");
    }
    // One reaction per action result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

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
        <ButtonLink href="/workspaces" variant="ghost" transition="back">
          {t("cancel")}
        </ButtonLink>
      </div>
    </form>
  );
}
