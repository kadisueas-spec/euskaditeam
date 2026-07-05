import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div>
        <Skeleton className="h-10 w-56" />
        <div className="mt-1.5 h-0.5 w-10 bg-[#e8001c]" />
      </div>
      {Array.from({ length: 2 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-6"
        >
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-4 h-10 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}
