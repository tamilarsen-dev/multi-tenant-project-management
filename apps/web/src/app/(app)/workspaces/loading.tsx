export default function Loading() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true">
      <div className="skeleton h-10 w-64 rounded-control" />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <li key={i} className="skeleton h-32 rounded-card" />
        ))}
      </ul>
    </div>
  );
}
