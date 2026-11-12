"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Button } from "@/components/button";
import type { OrganizationWithMembership } from "@/lib/api/types";

import { loadMoreWorkspaces } from "./actions";
import { WorkspaceCard } from "./workspace-card";

/** First page is server-rendered; "Show more" appends the next cursor page. */
export function WorkspaceList({
  initialItems,
  initialCursor,
}: {
  initialItems: OrganizationWithMembership[];
  initialCursor: string | null;
}) {
  const t = useTranslations("workspaces");
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function loadMore() {
    if (!cursor) return;
    startTransition(async () => {
      try {
        const page = await loadMoreWorkspaces(cursor);
        setItems((current) => [...current, ...page.items]);
        setCursor(page.pagination.nextCursor);
        setFailed(false);
      } catch {
        setFailed(true);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <WorkspaceCard key={item.organization.id} item={item} />
        ))}
      </ul>
      {cursor ? (
        <div className="flex flex-col items-center gap-2">
          <Button variant="secondary" onClick={loadMore} disabled={pending}>
            {pending ? t("loadingMore") : t("loadMore")}
          </Button>
          <p role="status" className="text-label text-danger-text">
            {failed ? t("loadMoreFailed") : null}
          </p>
        </div>
      ) : null}
    </div>
  );
}
