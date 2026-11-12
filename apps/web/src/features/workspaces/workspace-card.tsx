import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";

import { Pill } from "@/components/role-pill";
import type { OrganizationWithMembership } from "@/lib/api/types";

export function WorkspaceCard({ item }: { item: OrganizationWithMembership }) {
  const t = useTranslations();
  const format = useFormatter();
  const { organization, membership } = item;

  return (
    <li>
      <Link
        href={`/workspaces/${organization.id}`}
        className={
          "flex h-full flex-col gap-4 rounded-card border border-border bg-surface p-5 shadow-1 " +
          "transition-[border-color,transform] duration-[180ms] ease-standard hover:-translate-y-0.5 hover:border-accent"
        }
      >
        <span className="font-display text-h3 font-semibold break-words text-text">{organization.name}</span>
        <span className="mt-auto flex flex-wrap items-center justify-between gap-2">
          <Pill>{t(`roles.${membership.role}`)}</Pill>
          <span className="text-caption text-text-muted">
            {t("workspaces.created", { date: format.dateTime(new Date(organization.createdAt), { dateStyle: "medium" }) })}
          </span>
        </span>
      </Link>
    </li>
  );
}
