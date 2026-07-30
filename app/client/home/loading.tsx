import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Skeleton className="h-7 w-56" />
        <Skeleton className="mt-2 h-6 w-40" />
      </div>

      <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-5">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-2 h-9 w-40" />
        <Skeleton className="mt-2 h-4 w-24" />
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white/5 p-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <Skeleton className="h-7 w-10" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        ))}
      </div>

      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4"
        >
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-1.5 h-3 w-36" />
          </div>
        </div>
      ))}
    </div>
  );
}
