"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { formatDate } from "@/lib/utils/format-date";
import {
  deleteWorkoutLog,
  updateWorkoutLog,
} from "@/app/coach/clients/[id]/workout-log-actions";

type Log = { id: string; workoutDate: string; isCompleted: boolean };

// Editar/eliminar entrenamientos desde la vista del coach (jul-2026) —
// antes solo se podía corregir datos de prueba a mano por SQL Editor.
// Requiere la migración 20260711_coach_manage_workout_logs.sql aplicada
// (RLS de UPDATE/DELETE para el coach sobre workout_logs).
export function RecentLogsList({
  clientId,
  logs,
}: {
  clientId: string;
  logs: Log[];
}) {
  const [items, setItems] = useState(logs);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [draftDate, setDraftDate] = useState("");
  const [draftCompleted, setDraftCompleted] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function startEdit(log: Log) {
    setEditingId(log.id);
    setConfirmDeleteId(null);
    setDraftDate(log.workoutDate.slice(0, 10));
    setDraftCompleted(log.isCompleted);
    setError(null);
  }

  function saveEdit(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await updateWorkoutLog(clientId, id, {
        workoutDate: draftDate,
        isCompleted: draftCompleted,
      });
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      setItems((prev) =>
        prev
          .map((l) =>
            l.id === id
              ? { ...l, workoutDate: draftDate, isCompleted: draftCompleted }
              : l
          )
          .sort((a, b) => (a.workoutDate < b.workoutDate ? 1 : -1))
      );
      setEditingId(null);
    });
  }

  function confirmDelete(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteWorkoutLog(clientId, id);
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      setItems((prev) => prev.filter((l) => l.id !== id));
      setConfirmDeleteId(null);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <ul className="flex flex-col gap-2">
        {items.map((log) =>
          editingId === log.id ? (
            <li
              key={log.id}
              className="flex flex-col gap-2 rounded-lg border border-[#e8001c]/40 bg-[#e8001c]/5 p-3"
            >
              <div className="flex items-center gap-3">
                <Input
                  type="date"
                  value={draftDate}
                  onChange={(e) => setDraftDate(e.target.value)}
                  className="h-9 flex-1"
                />
                <label className="flex items-center gap-1.5 text-xs whitespace-nowrap text-[#888888]">
                  <input
                    type="checkbox"
                    checked={draftCompleted}
                    onChange={(e) => setDraftCompleted(e.target.checked)}
                  />
                  Completado
                </label>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 flex-1"
                  onClick={() => setEditingId(null)}
                  disabled={pending}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  className="h-8 flex-1"
                  onClick={() => saveEdit(log.id)}
                  disabled={pending}
                >
                  {pending && (
                    <Spinner size="sm" className="border-white/30 border-t-white" />
                  )}
                  {pending ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </li>
          ) : confirmDeleteId === log.id ? (
            <li
              key={log.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-[#e8001c]/40 bg-[#e8001c]/5 p-3 text-sm"
            >
              <span className="text-white">
                ¿Eliminar este entrenamiento? No se puede deshacer.
              </span>
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setConfirmDeleteId(null)}
                  disabled={pending}
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  className="h-8 bg-[#e8001c] hover:bg-[#b8001a]"
                  onClick={() => confirmDelete(log.id)}
                  disabled={pending}
                >
                  {pending && (
                    <Spinner size="sm" className="border-white/30 border-t-white" />
                  )}
                  Eliminar
                </Button>
              </div>
            </li>
          ) : (
            <li key={log.id} className="flex items-center justify-between text-sm">
              <span className="text-[#888888]">{formatDate(log.workoutDate)}</span>
              <div className="flex items-center gap-2">
                <Badge variant={log.isCompleted ? "default" : "outline"}>
                  {log.isCompleted ? "Completado" : "En curso"}
                </Badge>
                <button
                  type="button"
                  onClick={() => startEdit(log)}
                  aria-label="Editar entrenamiento"
                  className="flex size-8 items-center justify-center rounded-md text-[#888888] hover:bg-white/10 hover:text-white"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(log.id)}
                  aria-label="Eliminar entrenamiento"
                  className="flex size-8 items-center justify-center rounded-md text-[#888888] hover:bg-[#e8001c]/15 hover:text-[#e8001c]"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </li>
          )
        )}
      </ul>
    </div>
  );
}
