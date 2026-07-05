import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <Skeleton className="h-10 w-56" />
        <div className="mt-1.5 mb-1 h-0.5 w-10 bg-[#e8001c]" />
        <Skeleton className="mt-2 h-4 w-40" />
      </div>

      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-6"
        >
          <Skeleton className="h-6 w-32" />
          <div className="mt-4 flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="flex gap-3">
                <Skeleton className="size-7 shrink-0 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="mt-1.5 h-4 w-24" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
