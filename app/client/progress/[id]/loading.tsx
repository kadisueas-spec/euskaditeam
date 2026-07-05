import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Skeleton className="h-9 w-48" />
        <div className="mt-1.5 mb-1 h-0.5 w-10 bg-[#e8001c]" />
        <Skeleton className="h-4 w-24" />
      </div>

      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4"
        >
          <Skeleton className="h-5 w-32" />
          <div className="mt-3 flex flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
