import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <Skeleton className="h-10 w-56" />
        <div className="mt-1.5 h-0.5 w-10 bg-[#e8001c]" />
      </div>

      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-6"
        >
          <Skeleton className="h-5 w-40" />
          <div className="mt-4 flex flex-col gap-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
      ))}
    </div>
  );
}
