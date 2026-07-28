import { ScrollReveal } from "@/components/motion/scroll-reveal";
import { MonthRecapCover } from "@/components/client/month-recap/cover";
import { MonthRecapNumbers } from "@/components/client/month-recap/numbers";
import { MonthRecapStreaks } from "@/components/client/month-recap/streaks";
import { MonthRecapRecords } from "@/components/client/month-recap/records";
import { MonthRecapTopExercises } from "@/components/client/month-recap/top-exercises";
import { MonthRecapBodyComposition } from "@/components/client/month-recap/body-composition";
import { MonthRecapClosing } from "@/components/client/month-recap/closing";
import type { MyMonthSummary } from "@/lib/supabase/month-summary";

// Recorrido animado de "Mi Mes" (jul-2026) — reemplaza a MyMonthUnlocked.
// Cada bloque entra envuelto en ScrollReveal a medida que aparece en
// pantalla; el gate del candado (MonthUnlockReveal) sigue igual, esto es
// solo lo que se muestra una vez que ya se reveló.
export function MonthRecap({ data }: { data: MyMonthSummary }) {
  return (
    <div className="flex flex-col divide-y divide-[#1e1e1e]">
      <ScrollReveal>
        <MonthRecapCover
          monthLabel={data.monthLabel}
          clientFirstName={data.clientFirstName}
          adherencePercent={data.numbers.adherencePercent}
        />
      </ScrollReveal>

      <ScrollReveal>
        <MonthRecapNumbers numbers={data.numbers} />
      </ScrollReveal>

      <ScrollReveal>
        <MonthRecapStreaks streaks={data.streaks} />
      </ScrollReveal>

      <ScrollReveal>
        <MonthRecapRecords records={data.records} />
      </ScrollReveal>

      <ScrollReveal>
        <MonthRecapTopExercises topExercises={data.topExercises} />
      </ScrollReveal>

      {data.bodyComposition && (
        <ScrollReveal>
          <MonthRecapBodyComposition data={data.bodyComposition} />
        </ScrollReveal>
      )}

      <ScrollReveal>
        <MonthRecapClosing data={data} />
      </ScrollReveal>
    </div>
  );
}
