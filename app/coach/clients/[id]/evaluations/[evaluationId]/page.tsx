import { notFound } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/motion/fade-in";
import {
  getEvaluationDetail,
  getPreviousEvaluation,
} from "@/lib/supabase/anthropometrics";
import {
  PERIMETER_LABELS,
  PERIMETER_TYPES,
  PROTOCOL_LABELS,
  SKINFOLD_LABELS,
} from "@/lib/anthropometrics/constants";
import { formatDate } from "@/lib/utils/format-date";
import { DiffStat } from "./diff-stat";

function MeasurementRow({
  label,
  value,
  previousValue,
}: {
  label: string;
  value: number;
  previousValue?: number;
}) {
  const delta = previousValue != null ? Math.round((value - previousValue) * 10) / 10 : null;
  return (
    <li className="flex items-center justify-between text-sm">
      <span className="text-[#888888]">{label}</span>
      <span className="flex items-center gap-2 font-mono text-white">
        {value}
        {delta != null && delta !== 0 && (
          <span className="flex items-center gap-0.5 text-xs text-[#888888]">
            {delta > 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
            {Math.abs(delta)}
          </span>
        )}
      </span>
    </li>
  );
}

export default async function EvaluationDetailPage({
  params,
}: {
  params: Promise<{ id: string; evaluationId: string }>;
}) {
  const { id, evaluationId } = await params;
  const evaluation = await getEvaluationDetail(evaluationId);

  if (!evaluation || evaluation.clientId !== id) notFound();

  const previous = await getPreviousEvaluation(
    id,
    evaluation.evaluationDate,
    evaluation.id
  );

  const perimeterEntries = PERIMETER_TYPES.filter((t) => evaluation.measurements[t] != null);
  const skinfoldEntries = (Object.keys(SKINFOLD_LABELS) as (keyof typeof SKINFOLD_LABELS)[]).filter(
    (t) => evaluation.measurements[t] != null
  );

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-display text-4xl tracking-wide text-[#f5f5f5] uppercase">
          {formatDate(evaluation.evaluationDate)}
        </h1>
        <div className="mt-1.5 mb-1 h-0.5 w-10 bg-[#e8001c]" />
        <p className="text-sm text-[#888888]">{PROTOCOL_LABELS[evaluation.protocol]}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <DiffStat
          label="Peso"
          value={evaluation.weightKg}
          unit="kg"
          previousValue={previous?.weightKg}
        />
        {evaluation.bodyFatPercentage != null && (
          <DiffStat
            label="Grasa corporal"
            value={evaluation.bodyFatPercentage}
            unit="%"
            previousValue={previous?.bodyFatPercentage ?? undefined}
          />
        )}
        {evaluation.skinfoldSum != null && (
          <DiffStat
            label="∑8 pliegues"
            value={evaluation.skinfoldSum}
            unit="mm"
            previousValue={previous?.skinfoldSum ?? undefined}
          />
        )}
        {evaluation.fatMassKg != null && (
          <DiffStat
            label="Masa grasa"
            value={evaluation.fatMassKg}
            unit="kg"
            previousValue={previous?.fatMassKg ?? undefined}
          />
        )}
        {evaluation.muscleMassKg != null && (
          <DiffStat
            label="Masa muscular"
            value={evaluation.muscleMassKg}
            unit="kg"
            previousValue={previous?.muscleMassKg ?? undefined}
          />
        )}
        <DiffStat
          label="IMC"
          value={evaluation.bmi}
          unit=""
          previousValue={previous?.bmi}
        />
        {evaluation.waistHipRatio != null && (
          <DiffStat
            label="Índice cintura-cadera"
            value={evaluation.waistHipRatio}
            unit=""
            previousValue={previous?.waistHipRatio ?? undefined}
            decimals={2}
          />
        )}
      </div>

      {perimeterEntries.length > 0 && (
        <FadeIn delay={0.05}>
          <Card className="border-[#1e1e1e] bg-[#111111]">
            <CardHeader>
              <CardTitle className="text-base text-white">Perímetros (cm)</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2">
                {perimeterEntries.map((t) => (
                  <MeasurementRow
                    key={t}
                    label={PERIMETER_LABELS[t]}
                    value={evaluation.measurements[t]!}
                    previousValue={previous?.measurements[t]}
                  />
                ))}
              </ul>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {skinfoldEntries.length > 0 && (
        <FadeIn delay={0.1}>
          <Card className="border-[#1e1e1e] bg-[#111111]">
            <CardHeader>
              <CardTitle className="text-base text-white">Pliegues cutáneos (mm)</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2">
                {skinfoldEntries.map((t) => (
                  <MeasurementRow
                    key={t}
                    label={SKINFOLD_LABELS[t]}
                    value={evaluation.measurements[t]!}
                    previousValue={previous?.measurements[t]}
                  />
                ))}
              </ul>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {evaluation.coachNotes && (
        <FadeIn delay={0.15}>
          <Card className="border-[#1e1e1e] bg-[#111111]">
            <CardHeader>
              <CardTitle className="text-base text-white">Notas</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-[#888888]">
              {evaluation.coachNotes}
            </CardContent>
          </Card>
        </FadeIn>
      )}
    </div>
  );
}
