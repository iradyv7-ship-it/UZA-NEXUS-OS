export default function Loading() {
  return (
    <div className="space-y-3" aria-busy="true">
      <div className="h-6 w-32 animate-pulse rounded bg-slate-200" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-200/70" />
        ))}
      </div>
    </div>
  );
}
