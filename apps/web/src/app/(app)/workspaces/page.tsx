import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ButtonLink } from "@/components/button";
import { EmptyState } from "@/components/empty-state";
import { listWorkspaces } from "@/features/workspaces/api";
import { WorkspaceList } from "@/features/workspaces/workspace-list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("workspaces");
  return { title: t("metaTitle") };
}

export default async function WorkspacesPage() {
  const [t, page] = await Promise.all([getTranslations("workspaces"), listWorkspaces()]);
  const total = page.pagination.totalCount;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-h1 font-bold">{t("title")}</h1>
          {total > 0 ? <p className="text-text-muted">{t("count", { count: total })}</p> : null}
        </div>
        {total > 0 ? <ButtonLink href="/workspaces/new">{t("create")}</ButtonLink> : null}
      </div>

      {total === 0 ? (
        <EmptyState
          title={t("empty.title")}
          body={t("empty.body")}
          action={<ButtonLink href="/workspaces/new">{t("create")}</ButtonLink>}
        />
      ) : (
        <WorkspaceList initialItems={page.items} initialCursor={page.pagination.nextCursor} />
      )}
    </div>
  );
}
