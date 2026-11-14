"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect } from "react";

import { FormAlert } from "@/components/form-alert";
import { SubmitButton } from "@/components/submit-button";
import { TextField } from "@/components/text-field";

import { usePeg } from "@/features/peg/peg-provider";

import { renameWorkspace, type RenameState } from "./actions";

export function RenameWorkspaceForm({ id, name, version }: { id: string; name: string; version: number }) {
  const t = useTranslations("workspaces.settings");
  const [state, action] = useActionState(renameWorkspace, { status: "idle", name, version } satisfies RenameState);

  const peg = usePeg();

  // Peg acknowledges a save with a nod and a failure (conflict, permission) with a shake.
  useEffect(() => {
    if (state.status === "success") void peg?.play("save");
    else if (state.status === "error" && state.formError) void peg?.play("error");
    // One reaction per action result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const currentName = state.name ?? name;
  const currentVersion = state.version ?? version;

  return (
    // Keyed by version: after a save or a conflict the field resets to the latest server value.
    <form key={currentVersion} action={action} noValidate className="flex flex-col gap-5">
      <FormAlert message={state.formError} tone={state.status === "success" ? "success" : "danger"} />
      <input type="hidden" name="workspaceId" value={id} />
      <input type="hidden" name="version" value={currentVersion} />
      <TextField
        name="name"
        label={t("name")}
        defaultValue={state.values?.name ?? currentName}
        error={state.fieldErrors?.name}
        maxLength={100}
        autoComplete="off"
        required
      />
      <div>
        <SubmitButton label={t("submit")} pendingLabel={t("pending")} />
      </div>
    </form>
  );
}
