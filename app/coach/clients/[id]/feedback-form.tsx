"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { FEEDBACK_TYPE_LABEL } from "@/lib/constants/feedback";
import { formatDate } from "@/lib/utils/format-date";
import type { ExerciseOption, SessionOption } from "@/lib/supabase/feedback";
import { createFeedback, type FeedbackFormState } from "./actions";

export function FeedbackForm({
  clientId,
  sessions,
  exercises,
  defaultSessionId,
}: {
  clientId: string;
  sessions: SessionOption[];
  exercises: ExerciseOption[];
  defaultSessionId?: string;
}) {
  const action = createFeedback.bind(null, clientId);
  const [state, formAction, pending] = useActionState<
    FeedbackFormState,
    FormData
  >(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor="feedback-type">Tipo</Label>
        <NativeSelect id="feedback-type" name="type" defaultValue="general">
          {Object.entries(FEEDBACK_TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="feedback-message">Mensaje</Label>
        <Textarea id="feedback-message" name="message" rows={3} required />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="feedback-session">Sesión (opcional)</Label>
          <NativeSelect
            id="feedback-session"
            name="workout_log_id"
            defaultValue={defaultSessionId ?? "none"}
          >
            <option value="none">Ninguna</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {formatDate(s.label)}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="feedback-exercise">Ejercicio (opcional)</Label>
          <NativeSelect
            id="feedback-exercise"
            name="routine_exercise_id"
            defaultValue="none"
          >
            <option value="none">Ninguno</option>
            {exercises.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {state?.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Enviando..." : "Dejar feedback"}
      </Button>
    </form>
  );
}
