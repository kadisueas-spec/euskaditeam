"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
        <Select name="type" defaultValue="general">
          <SelectTrigger id="feedback-type" className="w-full">
            <SelectValue placeholder="Tipo de feedback">
              {(value: string | null) =>
                FEEDBACK_TYPE_LABEL[value as keyof typeof FEEDBACK_TYPE_LABEL] ??
                "Tipo de feedback"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(FEEDBACK_TYPE_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="feedback-message">Mensaje</Label>
        <Textarea id="feedback-message" name="message" rows={3} required />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="feedback-session">Sesión (opcional)</Label>
          <Select
            name="workout_log_id"
            defaultValue={defaultSessionId ?? "none"}
          >
            <SelectTrigger id="feedback-session" className="w-full">
              <SelectValue placeholder="Ninguna">
                {(value: string | null) => {
                  const session = sessions.find((s) => s.id === value);
                  return session ? formatDate(session.label) : "Ninguna";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Ninguna</SelectItem>
              {sessions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {formatDate(s.label)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="feedback-exercise">Ejercicio (opcional)</Label>
          <Select name="routine_exercise_id" defaultValue="none">
            <SelectTrigger id="feedback-exercise" className="w-full">
              <SelectValue placeholder="Ninguno">
                {(value: string | null) =>
                  exercises.find((ex) => ex.id === value)?.name ?? "Ninguno"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Ninguno</SelectItem>
              {exercises.map((ex) => (
                <SelectItem key={ex.id} value={ex.id}>
                  {ex.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
