import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <Skeleton className="h-10 w-56" />
        <div className="mt-1.5 h-0.5 w-10 bg-[#e8001c]" />
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    </div>
  );
}
