import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Skeleton className="h-9 w-48" />
        <div className="mt-1.5 mb-1 h-0.5 w-10 bg-[#e8001c]" />
      </div>

      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-2xl border border-[#1e1e1e] bg-[#111111] p-5"
        >
          <div>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="mt-2 h-4 w-20" />
          </div>
          <Skeleton className="size-5 rounded-full" />
        </div>
      ))}
    </div>
  );
}
