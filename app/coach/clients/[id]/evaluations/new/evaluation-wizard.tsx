"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { FadeIn } from "@/components/motion/fade-in";
import { sanitizeDecimalInput, parseDecimalInput } from "@/lib/utils/decimal-input";
import {
  calculateEvaluation,
  PROTOCOL_REQUIRED_SKINFOLDS,
  type Protocol,
  type Sex,
  type SkinfoldType,
} from "@/lib/anthropometrics/formulas";
import {
  PERIMETER_LABELS,
  PERIMETER_TYPES,
  PROTOCOLS,
  PROTOCOL_LABELS,
  SKINFOLD_LABELS,
  type PerimeterType,
} from "@/lib/anthropometrics/constants";
import type { ClientBodyInfo } from "@/lib/supabase/anthropometrics";
import { createEvaluation } from "../actions";

function requiredSkinfoldsFor(protocol: Protocol, sex: Sex): SkinfoldType[] {
  const req = PROTOCOL_REQUIRED_SKINFOLDS[protocol];
  return Array.isArray(req) ? req : req[sex];
}

function emptyDecimalRecord<T extends string>(keys: readonly T[]): Record<T, string> {
  return Object.fromEntries(keys.map((k) => [k, ""])) as Record<T, string>;
}

const ALL_SKINFOLD_TYPES = Object.keys(SKINFOLD_LABELS) as SkinfoldType[];

export function EvaluationWizard({
  clientId,
  bodyInfo,
}: {
  clientId: string;
  bodyInfo: ClientBodyInfo;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [evaluationDate, setEvaluationDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState(
    bodyInfo.latestHeightCm != null ? String(bodyInfo.latestHeightCm) : ""
  );
  const [sex, setSex] = useState<Sex | "">(bodyInfo.sex ?? "");
  const [birthDate, setBirthDate] = useState(bodyInfo.birthDate ?? "");
  const [protocol, setProtocol] = useState<Protocol | "">("");

  const [perimeters, setPerimeters] = useState<Record<PerimeterType, string>>(() =>
    emptyDecimalRecord(PERIMETER_TYPES)
  );
  const [skinfolds, setSkinfolds] = useState<Record<SkinfoldType, string>>(() =>
    emptyDecimalRecord(ALL_SKINFOLD_TYPES)
  );
  const [coachNotes, setCoachNotes] = useState("");

  function goToStep2() {
    if (!evaluationDate || !weightKg || !heightCm || !sex || !birthDate || !protocol) {
      setError("Completá todos los campos antes de continuar.");
      return;
    }
    setError(null);
    setStep(2);
  }

  function goToStep3() {
    setError(null);
    setStep(3);
  }

  function goToStep4() {
    if (!protocol || !sex) return;
    const required = requiredSkinfoldsFor(protocol, sex);
    const missing = required.filter((t) => !skinfolds[t]);
    if (missing.length > 0) {
      setError(
        `Faltan pliegues para este protocolo: ${missing.map((t) => SKINFOLD_LABELS[t]).join(", ")}.`
      );
      return;
    }
    setError(null);
    setStep(4);
  }

  const parsedPerimeters = Object.fromEntries(
    PERIMETER_TYPES.map((t) => [t, perimeters[t] ? parseDecimalInput(perimeters[t]) : null])
  ) as Record<PerimeterType, number | null>;

  const parsedSkinfolds = Object.fromEntries(
    ALL_SKINFOLD_TYPES.map((t) => [t, skinfolds[t] ? parseDecimalInput(skinfolds[t]) : null])
  ) as Record<SkinfoldType, number | null>;

  const preview =
    protocol && sex && weightKg && heightCm && birthDate
      ? calculateEvaluation({
          protocol,
          sex,
          age: (() => {
            const birth = new Date(`${birthDate}T00:00:00Z`);
            const at = new Date(`${evaluationDate}T00:00:00Z`);
            let age = at.getUTCFullYear() - birth.getUTCFullYear();
            const hadBirthday =
              at.getUTCMonth() > birth.getUTCMonth() ||
              (at.getUTCMonth() === birth.getUTCMonth() && at.getUTCDate() >= birth.getUTCDate());
            if (!hadBirthday) age--;
            return age;
          })(),
          weightKg: parseDecimalInput(weightKg) ?? 0,
          heightCm: parseDecimalInput(heightCm) ?? 0,
          waistCm: parsedPerimeters.waist,
          hipCm: parsedPerimeters.hip,
          skinfolds: Object.fromEntries(
            Object.entries(parsedSkinfolds).filter(([, v]) => v != null)
          ),
        })
      : null;

  function handleSubmit() {
    if (!protocol || !sex) return;
    setError(null);
    startTransition(async () => {
      const result = await createEvaluation({
        clientId,
        evaluationDate,
        weightKg: parseDecimalInput(weightKg) ?? 0,
        heightCm: parseDecimalInput(heightCm) ?? 0,
        sex,
        birthDate,
        protocol,
        perimeters: Object.fromEntries(
          Object.entries(parsedPerimeters).filter(([, v]) => v != null)
        ),
        skinfolds: Object.fromEntries(
          Object.entries(parsedSkinfolds).filter(([, v]) => v != null)
        ),
        coachNotes,
      });

      if ("error" in result) {
        setError(result.error);
        return;
      }

      router.push(`/coach/clients/${clientId}/evaluations/${result.id}`);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2 text-sm">
        {[1, 2, 3, 4].map((s) => (
          <span
            key={s}
            className={`flex-1 rounded-full py-1.5 text-center font-display tracking-widest uppercase transition-colors ${
              step === s
                ? "bg-[#e8001c] text-white shadow-[0_0_12px_rgba(232,0,28,0.4)]"
                : "bg-white/5 text-[#888888]"
            }`}
          >
            Paso {s}
          </span>
        ))}
      </div>

      {step === 1 && (
        <FadeIn className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label>Fecha de la evaluación</Label>
            <Input
              type="date"
              value={evaluationDate}
              onChange={(e) => setEvaluationDate(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label>Peso (kg)</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={weightKg}
                onChange={(e) => setWeightKg(sanitizeDecimalInput(e.target.value))}
                className="h-11"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Altura (cm)</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={heightCm}
                onChange={(e) => setHeightCm(sanitizeDecimalInput(e.target.value))}
                className="h-11"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label>Sexo</Label>
              <NativeSelect
                value={sex}
                onChange={(e) => setSex(e.target.value as Sex)}
              >
                <option value="" disabled>Elegir</option>
                <option value="male">Masculino</option>
                <option value="female">Femenino</option>
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1">
              <Label>Fecha de nacimiento</Label>
              <Input
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="h-11"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label>Protocolo</Label>
            <NativeSelect
              value={protocol}
              onChange={(e) => setProtocol(e.target.value as Protocol)}
            >
              <option value="" disabled>Elegir</option>
              {PROTOCOLS.map((p) => (
                <option key={p} value={p}>
                  {PROTOCOL_LABELS[p]}
                </option>
              ))}
            </NativeSelect>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={goToStep2} className="min-h-[52px] w-full text-base">
            Siguiente
          </Button>
        </FadeIn>
      )}

      {step === 2 && (
        <FadeIn className="flex flex-col gap-4">
          <p className="text-sm text-[#888888]">
            Perímetros (cm) — dejá vacío lo que no se haya medido.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {PERIMETER_TYPES.map((t) => (
              <div key={t} className="flex flex-col gap-1">
                <Label className="text-xs">{PERIMETER_LABELS[t]}</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={perimeters[t]}
                  onChange={(e) =>
                    setPerimeters((p) => ({
                      ...p,
                      [t]: sanitizeDecimalInput(e.target.value),
                    }))
                  }
                  className="h-11"
                />
              </div>
            ))}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)} className="min-h-[52px] flex-1 text-base">
              Atrás
            </Button>
            <Button onClick={goToStep3} className="min-h-[52px] flex-1 text-base">
              Siguiente
            </Button>
          </div>
        </FadeIn>
      )}

      {step === 3 && protocol && sex && (
        <FadeIn className="flex flex-col gap-4">
          <p className="text-sm text-[#888888]">
            Pliegues cutáneos (mm) — {PROTOCOL_LABELS[protocol]}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {requiredSkinfoldsFor(protocol, sex).map((t) => (
              <div key={t} className="flex flex-col gap-1">
                <Label className="text-xs">{SKINFOLD_LABELS[t]}</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={skinfolds[t]}
                  onChange={(e) =>
                    setSkinfolds((s) => ({
                      ...s,
                      [t]: sanitizeDecimalInput(e.target.value),
                    }))
                  }
                  className="h-11"
                />
              </div>
            ))}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(2)} className="min-h-[52px] flex-1 text-base">
              Atrás
            </Button>
            <Button onClick={goToStep4} className="min-h-[52px] flex-1 text-base">
              Siguiente
            </Button>
          </div>
        </FadeIn>
      )}

      {step === 4 && preview && protocol && (
        <FadeIn className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            {preview.bodyFatPercentage != null && (
              <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-3">
                <p className="font-display text-3xl text-[#e8001c]">
                  {preview.bodyFatPercentage.toFixed(1)}%
                </p>
                <p className="text-xs text-[#888888] uppercase">Grasa corporal</p>
              </div>
            )}
            {preview.skinfoldSum != null && (
              <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-3">
                <p className="font-display text-3xl text-[#e8001c]">
                  {preview.skinfoldSum.toFixed(1)} mm
                </p>
                <p className="text-xs text-[#888888] uppercase">∑8 pliegues</p>
              </div>
            )}
            {preview.fatMassKg != null && (
              <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-3">
                <p className="font-display text-3xl text-[#e8001c]">
                  {preview.fatMassKg.toFixed(1)} kg
                </p>
                <p className="text-xs text-[#888888] uppercase">Masa grasa</p>
              </div>
            )}
            {preview.muscleMassKg != null && (
              <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-3">
                <p className="font-display text-3xl text-[#e8001c]">
                  {preview.muscleMassKg.toFixed(1)} kg
                </p>
                <p className="text-xs text-[#888888] uppercase">Masa muscular</p>
              </div>
            )}
            <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-3">
              <p className="font-display text-3xl text-[#e8001c]">{preview.bmi.toFixed(1)}</p>
              <p className="text-xs text-[#888888] uppercase">IMC</p>
            </div>
            {preview.waistHipRatio != null && (
              <div className="rounded-2xl border border-[#1e1e1e] bg-[#111111] p-3">
                <p className="font-display text-3xl text-[#e8001c]">
                  {preview.waistHipRatio.toFixed(2)}
                </p>
                <p className="text-xs text-[#888888] uppercase">Índice cintura-cadera</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="coach-notes">Notas del coach</Label>
            <Textarea
              id="coach-notes"
              value={coachNotes}
              onChange={(e) => setCoachNotes(e.target.value)}
              rows={4}
              placeholder="Observaciones sobre esta evaluación..."
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(3)} disabled={pending} className="min-h-[52px] flex-1 text-base">
              Atrás
            </Button>
            <Button onClick={handleSubmit} disabled={pending} className="min-h-[52px] flex-1 text-base">
              {pending && <Spinner size="sm" className="border-white/30 border-t-white" />}
              {pending ? "Guardando..." : "Guardar evaluación"}
            </Button>
          </div>
        </FadeIn>
      )}
    </div>
  );
}
