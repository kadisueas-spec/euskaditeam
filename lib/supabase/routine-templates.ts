import { createClient } from "@/lib/supabase/server";

// Plantillas de rutinas (oct-2026): filas de routines con is_template =
// true — sin cliente, sin fechas, nunca activas (CHECK
// routines_template_shape). Solo lectura acá; la escritura vive en
// app/coach/routines/template-actions.ts (mismo split que routines.ts).
export type TemplateListItem = {
  id: string;
  name: string;
  objective: string | null;
  dayCount: number;
  exerciseCount: number;
};

type TemplateListRow = {
  id: string;
  name: string;
  objective: string | null;
  routine_days: { routine_exercises: { id: string }[] }[];
};

export async function getTemplatesList(): Promise<TemplateListItem[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("routines")
    .select(`id, name, objective, routine_days ( routine_exercises ( id ) )`)
    .eq("is_template", true)
    .order("name", { ascending: true })
    .returns<TemplateListRow[]>();

  return (data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    objective: t.objective,
    dayCount: t.routine_days.length,
    exerciseCount: t.routine_days.reduce(
      (sum, d) => sum + d.routine_exercises.length,
      0
    ),
  }));
}
