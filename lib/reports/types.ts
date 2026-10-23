// Reportes de progreso tipo Wrapped (oct-2026) — ver docs/plan-reportes.md.
// Estas tarjetas son lo que se guarda en progress_reports.cards (jsonb) y
// lo único que ve el cliente: se arman al generar el borrador y NO se
// recalculan al enviar, así el cliente ve exactamente lo que revisó el
// coach. Lo privado del coach (avisos) nunca entra acá — va a
// progress_report_private.
//
// Catálogo (oct-2026): el generador arma TODAS las tarjetas posibles y
// marca con `on: false` las que no van por defecto (volumen que bajó,
// gráficos de ejercicios, etc.). El coach prende/apaga y reordena en la
// bandeja (progress_reports.card_layout, ver lib/reports/layout.ts); al
// enviar se guardan solo las prendidas, en su orden.

// weekly = lunes a viernes; monthly = mes calendario; custom = rango libre.
export type ReportKind = "weekly" | "monthly" | "custom";

// Un tema por tarjeta (fondo + color). La portada siempre es roja.
export type CardTheme = "red" | "black" | "card" | "light" | "oxblood";

export type CardLink = { label: string; href: string };

// Fila de una mejor marca: "90 × 10" + diferencia en rojo ("+2 REPS",
// "+5 KG", "RIR 3 (antes 1)").
export type RecordRow = { exercise: string; value: string; diff: string };

type Base = {
  theme: CardTheme;
  // Clave estable ("volume", "exercise:<id>"): con ella se guardan las
  // elecciones del coach y se mantienen al regenerar. Opcional solo por los
  // borradores creados antes de que existiera.
  key?: string;
  // false = disponible pero apagada por defecto. Ausente = prendida.
  on?: boolean;
  phrase?: string;
  phraseKey?: string;
  link?: CardLink;
};

export type ReportCard =
  | (Base & { type: "opening"; words: string[] })
  | (Base & {
      type: "improvement";
      kicker: string;
      exercise: string;
      value: string; // "+3", "+10"
      unit: string; // "reps", "kg", "RIR"
      detail: string; // "220 kg × 13 — antes 220 kg × 10"
      more: RecordRow[];
    })
  | (Base & { type: "effort"; sets: number; volumeKg: number })
  | (Base & {
      type: "adherence";
      done: number;
      planned: number;
      days: { label: string; dayName: string | null }[];
    })
  | (Base & { type: "count"; kicker: string; value: number; label: string; detail: string })
  | (Base & { type: "records"; value: number; list: RecordRow[] })
  | (Base & {
      type: "volume";
      kicker: string; // "Contra agosto", "Contra la semana pasada"
      percent: number; // puede ser negativo: el coach decide si mostrarla
      previous: { label: string; volumeKg: number; sessions: number };
      current: { label: string; volumeKg: number; sessions: number };
    })
  | (Base & { type: "streak"; value: number; unit: string; detail: string })
  | (Base & {
      type: "weight";
      kicker: string;
      headline: string; // "−2,8", "86,5"
      fromTo: string | null; // "89,3 kg → 86,5 kg"
      detail: string | null;
      series: { weekStart: string; kg: number }[];
      lastLabel: string;
    })
  | (Base & {
      type: "body";
      date: string;
      bodyFat: number | null;
      bodyFatDiff: number | null;
      muscleKg: number | null;
    })
  | (Base & { type: "goal"; goal: string; evidence: string[] })
  // Evolución de un ejercicio puntual (mejor peso por sesión, últimas 12
  // semanas hasta el fin del período). Siempre opcional.
  | (Base & {
      type: "exercise";
      exercise: string;
      headline: string; // "+10" o "90"
      detail: string; // "200 kg → 210 kg · últimas 12 semanas"
      points: { date: string; kg: number }[];
    })
  | (Base & { type: "focus"; word: string })
  | (Base & {
      type: "coach-message";
      text: string;
      coachName: string;
      coachAvatarUrl: string | null;
    })
  | (Base & {
      type: "closing";
      words: string[];
      coachName: string;
      coachAvatarUrl: string | null;
    })
  | (Base & {
      type: "share";
      monthLabel: string;
      words: string[]; // mes apilado ("Sep", "tiem", "bre")
      clientName: string;
      stats: { value: string; label: string }[];
    })
  // Nota personal del coach: se agrega como última tarjeta AL ENVIAR (no
  // al generar), así el coach la puede escribir y corregir en la bandeja.
  | (Base & {
      type: "coach-note";
      text: string;
      coachName: string;
      coachAvatarUrl: string | null;
    });

export type BuiltReport = {
  cards: ReportCard[];
  phraseKeys: string[];
  // Avisos "Solo lo ves vos" → progress_report_private.notices.
  notices: string[];
};
