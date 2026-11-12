import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { canManage, getWorkspace } from "@/features/workspaces/api";
import { RenameWorkspaceForm } from "@/features/workspaces/rename-workspace-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("workspaces.settings");
  return { title: t("metaTitle") };
}

export default async function WorkspaceSettingsPage({ params }: PageProps<"/workspaces/[workspaceId]/settings">) {
  const { workspaceId } = await params;
  const [{ organization, membership }, t] = await Promise.all([getWorkspace(workspaceId), getTranslations()]);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-8">
      <nav aria-label={t("nav.breadcrumb")}>
        <Link href={`/workspaces/${organization.id}`} className="text-label font-semibold text-accent-ink hover:underline">
          <span aria-hidden="true">← </span>
          {organization.name}
        </Link>
      </nav>
      <h1 className="text-h1 font-bold">{t("workspaces.settings.title")}</h1>
      <section aria-labelledby="general" className="flex flex-col gap-5 rounded-tile border border-border bg-surface p-6 shadow-1">
        <h2 id="general" className="text-h3 font-semibold">
          {t("workspaces.settings.general")}
        </h2>
        {canManage(membership.role) ? (
          <RenameWorkspaceForm id={organization.id} name={organization.name} version={organization.version} />
        ) : (
          <p className="text-text-muted">
            {t("workspaces.settings.readOnly", { role: t(`roles.${membership.role}`).toLowerCase() })}
          </p>
        )}
      </section>
    </div>
  );
}
