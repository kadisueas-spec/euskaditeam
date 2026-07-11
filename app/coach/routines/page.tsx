import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FadeIn } from "@/components/motion/fade-in";
import { getRoutinesList } from "@/lib/supabase/routines";

export default async function RoutinesPage() {
  const routines = await getRoutinesList();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl tracking-wide text-[#f5f5f5] uppercase">
            Rutinas
          </h1>
          <div className="mt-1.5 h-0.5 w-10 bg-[#e8001c]" />
        </div>
        <Link
          href="/coach/routines/new"
          className={buttonVariants({ variant: "default" })}
        >
          + Nueva rutina
        </Link>
      </div>

      {routines.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Todavía no creaste rutinas." />
      ) : (
        <ul className="flex flex-col gap-3">
          {routines.map((r, i) => (
            <FadeIn key={r.id} delay={Math.min(i * 0.05, 0.4)}>
              <Link
                href={`/coach/routines/${r.id}`}
                className="flex items-center justify-between rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4 transition-colors duration-200 hover:border-[#e8001c]"
              >
                <div>
                  <p className="font-medium text-white">{r.name}</p>
                  <p className="text-sm text-[#888888]">
                    {r.clientName ?? "Sin cliente"}
                  </p>
                </div>
                <Badge variant={r.isActive ? "default" : "secondary"}>
                  {r.isActive ? "Activa" : "Archivada"}
                </Badge>
              </Link>
            </FadeIn>
          ))}
        </ul>
      )}
    </div>
  );
}
