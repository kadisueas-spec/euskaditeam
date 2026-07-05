import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-9 w-32" />
          <div className="mt-1.5 h-0.5 w-10 bg-[#e8001c]" />
        </div>
        <Skeleton className="h-8 w-32 rounded-full" />
      </div>

      <ul className="flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <li
            key={i}
            className="flex items-center justify-between rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4"
          >
            <div>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-2 h-3 w-20" />
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
          </li>
        ))}
      </ul>
    </div>
  );
}
