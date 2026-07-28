import { ShareMonthButton } from "@/components/client/month-recap/share-button";
import type { MyMonthSummary } from "@/lib/supabase/month-summary";

function closingMessage(adherencePercent: number): string {
  if (adherencePercent >= 90) return "Así se construye una temporada. Nos vemos el mes que viene.";
  if (adherencePercent >= 70) return "Mes a mes, esto se sostiene. Seguimos.";
  if (adherencePercent >= 50) return "Lo que cuenta es que no soltaste. Vamos por más.";
  return "El mes que viene arranca de cero. Estamos con vos.";
}

export function MonthRecapClosing({ data }: { data: MyMonthSummary }) {
  const closing = closingMessage(data.numbers.adherencePercent);
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 py-12 text-center">
      <p className="max-w-xs font-display text-2xl tracking-wide text-[#f5f5f5] uppercase">
        {closing}
      </p>
      {/* Sin logro que valga un trofeo (mes muy flojo) -> mejor no
          ofrecer compartir que ofrecer algo pobre. */}
      {data.highlight && (
        <ShareMonthButton
          data={{
            clientFirstName: data.clientFirstName,
            monthLabel: data.monthLabel,
            bigNumber: data.highlight.main.bigNumber,
            phrase: data.highlight.main.phrase,
            backups: data.shareBackups,
            highlightType: data.highlight.main.type,
            voiceLine: closing,
          }}
        />
      )}
    </div>
  );
}
