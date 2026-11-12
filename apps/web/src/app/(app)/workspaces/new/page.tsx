import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CreateWorkspaceForm } from "@/features/workspaces/create-workspace-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("workspaces.new");
  return { title: t("metaTitle") };
}

export default async function NewWorkspacePage() {
  const t = await getTranslations("workspaces.new");
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-h1 font-bold">{t("title")}</h1>
        <p className="text-text-muted">{t("subtitle")}</p>
      </div>
      <div className="rounded-tile border border-border bg-surface p-6 shadow-1">
        <CreateWorkspaceForm />
      </div>
    </div>
  );
}
