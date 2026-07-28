function coverPhrase(adherencePercent: number): string {
  if (adherencePercent >= 90) return "Un mes impecable.";
  if (adherencePercent >= 70) return "Un mes sólido.";
  if (adherencePercent >= 50) return "Un mes de oficio.";
  return "Un mes difícil. Pero volviste.";
}

export function MonthRecapCover({
  monthLabel,
  clientFirstName,
  adherencePercent,
}: {
  monthLabel: string;
  clientFirstName: string;
  adherencePercent: number;
}) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 py-12 text-center">
      <p className="font-display text-6xl tracking-wide text-[#f5f5f5] uppercase">
        {monthLabel}
      </p>
      {clientFirstName && (
        <p className="text-lg text-[#888888]">{clientFirstName}</p>
      )}
      <p className="mt-4 font-display text-2xl tracking-wide text-[#e8001c] uppercase">
        {coverPhrase(adherencePercent)}
      </p>
    </div>
  );
}
