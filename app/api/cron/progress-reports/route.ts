import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { generateDrafts, sendDueReports } from "@/lib/reports/service";
import { monthlyPeriodToGenerate, weeklyPeriodToGenerate } from "@/lib/reports/schedule";

// Cron horario de los reportes de progreso (oct-2026): lo llama pg_cron
// (supabase/migrations/20261022b_progress_reports_cron.sql) a los :05 con
// "Authorization: Bearer <CRON_SECRET>". Idempotente:
// - sábado desde las 11 PYT (y domingo): borradores semanales;
// - días 1 a 3 desde las 7 PYT: borradores mensuales del mes anterior;
// - siempre: envía los reportes que el coach PROGRAMÓ y cuya hora llegó.
// Nunca envía un borrador.
export const maxDuration = 300;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error("cron reportes: falta CRON_SECRET en las variables de entorno.");
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const result: Record<string, unknown> = {};

  const weekly = weeklyPeriodToGenerate(now);
  if (weekly) result.weekly = { period: weekly, ...(await generateDrafts("weekly", weekly)) };

  const monthly = monthlyPeriodToGenerate(now);
  if (monthly) result.monthly = { period: monthly, ...(await generateDrafts("monthly", monthly)) };

  result.scheduled = await sendDueReports(now);

  console.log("cron reportes:", JSON.stringify(result));
  return NextResponse.json(result);
}
