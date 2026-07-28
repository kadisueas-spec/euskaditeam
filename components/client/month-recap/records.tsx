import { Trophy } from "lucide-react";
import type { MonthSummaryRecords } from "@/lib/supabase/month-summary";
import { recordSummaryLine } from "@/lib/utils/session-records";

export function MonthRecapRecords({ records }: { records: MonthSummaryRecords }) {
  return (
    <div className="flex flex-col gap-4 py-10">
      <p className="text-center font-display text-2xl tracking-wide text-[#f5f5f5] uppercase">
        Récords del mes
      </p>

      {records.totalCount === 0 ? (
        <p className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-5 text-center text-sm text-[#888888]">
          Este mes fue de consolidar. También suma.
        </p>
      ) : (
        <>
          <p className="text-center font-display text-5xl text-[#e8001c]">
            {records.totalCount}
            <span className="block text-sm font-normal text-[#888888] uppercase">
              récord{records.totalCount === 1 ? "" : "s"} conseguido
              {records.totalCount === 1 ? "" : "s"}
            </span>
          </p>

          <ul className="flex flex-col gap-2 rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
            {records.records.map((record) => (
              <li
                key={record.id}
                className="flex items-center gap-2 text-sm text-[#f5f5f5]"
              >
                <Trophy className="size-3.5 shrink-0 text-[#e8001c]" />
                {recordSummaryLine(record)}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
