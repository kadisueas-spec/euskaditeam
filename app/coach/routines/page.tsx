import Link from "next/link";
import { BookmarkPlus, ClipboardList } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FadeIn } from "@/components/motion/fade-in";
import { getRoutinesList } from "@/lib/supabase/routines";
import { getTemplatesList } from "@/lib/supabase/routine-templates";
import { RoutineListItem } from "./routine-list-item";
import { TemplateListItem } from "./template-list-item";

type Tab = "rutinas" | "plantillas";

// Plantillas (oct-2026): pestañas por searchParam (?tab=plantillas) en vez
// de estado de cliente — así "Eliminar plantilla" desde el detalle puede
// volver directo a esta pestaña.
export default async function RoutinesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabParam } = await searchParams;
  const tab: Tab = tabParam === "plantillas" ? "plantillas" : "rutinas";

  const [routines, templates] = await Promise.all([getRoutinesList(), getTemplatesList()]);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "rutinas", label: "Rutinas", count: routines.length },
    { key: "plantillas", label: "Plantillas", count: templates.length },
  ];

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

      <div className="flex gap-2">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.key === "rutinas" ? "/coach/routines" : "/coach/routines?tab=plantillas"}
            className={`flex min-h-[40px] items-center rounded-full px-4 text-xs font-semibold tracking-wide uppercase transition-colors ${
              tab === t.key ? "bg-[#e8001c] text-white" : "bg-white/5 text-[#888888]"
            }`}
          >
            {t.label} ({t.count})
          </Link>
        ))}
      </div>

      {tab === "rutinas" ? (
        routines.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Todavía no armaste ninguna rutina."
            description="Tus clientes están esperando su plan."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {routines.map((r, i) => (
              <FadeIn key={r.id} delay={Math.min(i * 0.05, 0.4)}>
                <RoutineListItem routine={r} />
              </FadeIn>
            ))}
          </ul>
        )
      ) : templates.length === 0 ? (
        <EmptyState
          icon={BookmarkPlus}
          title="Todavía no tenés plantillas."
          description='Creá una desde "Nueva rutina" → "Guardar como plantilla", o desde la Rutina activa de un cliente.'
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {templates.map((t, i) => (
            <FadeIn key={t.id} delay={Math.min(i * 0.05, 0.4)}>
              <TemplateListItem template={t} />
            </FadeIn>
          ))}
        </ul>
      )}
    </div>
  );
}
