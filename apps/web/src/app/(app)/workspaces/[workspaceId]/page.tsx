import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { ButtonLink } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { Pill } from "@/components/role-pill";
import { canManage, getWorkspace } from "@/features/workspaces/api";

export async function generateMetadata({ params }: PageProps<"/workspaces/[workspaceId]">): Promise<Metadata> {
  const { workspaceId } = await params;
  const { organization } = await getWorkspace(workspaceId);
  return { title: organization.name };
}

export default async function WorkspacePage({ params }: PageProps<"/workspaces/[workspaceId]">) {
  const { workspaceId } = await params;
  const [{ organization, membership }, t, format] = await Promise.all([
    getWorkspace(workspaceId),
    getTranslations(),
    getFormatter(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <nav aria-label={t("nav.breadcrumb")}>
        <Link href="/workspaces" className="text-label font-semibold text-accent-ink hover:underline">
          <span aria-hidden="true">← </span>
          {t("nav.workspaces")}
        </Link>
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-3">
          <h1 className="text-h1 font-bold break-words">{organization.name}</h1>
          <div className="flex flex-wrap items-center gap-3">
            <Pill>{t(`roles.${membership.role}`)}</Pill>
            <span className="text-label text-text-muted">
              {t("workspaces.detail.memberSince", {
                date: format.dateTime(new Date(membership.joinedAt), { dateStyle: "medium" }),
              })}
            </span>
          </div>
        </div>
        {canManage(membership.role) ? (
          <ButtonLink href={`/workspaces/${organization.id}/settings`} variant="secondary">
            {t("workspaces.detail.settings")}
          </ButtonLink>
        ) : null}
      </div>
      <EmptyState title={t("workspaces.detail.readyTitle")} body={t("workspaces.detail.readyBody")} />
    </div>
  );
}
