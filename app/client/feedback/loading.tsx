import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Skeleton className="h-9 w-32" />
        <div className="mt-1.5 h-0.5 w-10 bg-[#e8001c]" />
      </div>

      <ul className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <li
            key={i}
            className="flex items-start gap-3 rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4"
          >
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-3 w-14" />
              </div>
              <Skeleton className="mt-2 h-4 w-full" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
