/** docs/design/api/contract.md §2.3 */
export function toOrganizationDto(o: {
  id: string;
  name: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: o.id,
    name: o.name,
    version: o.version,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}
