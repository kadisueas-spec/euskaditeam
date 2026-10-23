"use client";

import { GripVertical, Lock } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { NativeSelect } from "@/components/ui/native-select";
import { arrangeCards, cardLabel } from "@/lib/reports/layout";
import type { ArrangedCard, CardLayout } from "@/lib/reports/layout";
import type { ReportCard } from "@/lib/reports/types";

// Panel "Tarjetas" del borrador (oct-2026): prender/apagar y reordenar.
// Mismo arrastre que el editor de rutinas: siempre desde el ícono de agarre
// (44x44, touch-none) para no pelear con el scroll en iPhone; MouseSensor +
// TouchSensor con delay, no PointerSensor. Portada, cierre e imagen para
// compartir son fijas. Los gráficos de ejercicios apagados no se listan
// (serían muchos): se agregan desde el selector de abajo.

function Switch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className="flex size-11 shrink-0 items-center justify-center"
    >
      <span className={`relative h-6 w-10 rounded-full transition-colors ${checked ? "bg-[#e8001c]" : "bg-[#2a2a2a]"}`}>
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-white transition-[left] ${checked ? "left-[18px]" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}

function Row({ item, onToggle }: { item: ArrangedCard; onToggle: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.key,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-1 rounded-xl border bg-[#111111] pr-2 ${
        isDragging ? "z-10 border-[#e8001c]" : "border-[#1e1e1e]"
      }`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Mover ${cardLabel(item.card)}`}
        className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-[#888888] active:cursor-grabbing active:bg-white/10 active:text-[#e8001c]"
      >
        <GripVertical className="size-5" />
      </button>
      <span className={`min-w-0 flex-1 truncate text-sm ${item.enabled ? "text-white" : "text-[#666666]"}`}>
        {cardLabel(item.card)}
      </span>
      <Switch checked={item.enabled} onChange={onToggle} label={`Mostrar ${cardLabel(item.card)}`} />
    </li>
  );
}

function FixedRow({ item }: { item: ArrangedCard }) {
  return (
    <li className="flex min-h-11 items-center gap-1 rounded-xl border border-dashed border-[#1e1e1e] pr-3">
      <span className="flex size-11 shrink-0 items-center justify-center text-[#555555]">
        <Lock className="size-4" aria-hidden />
      </span>
      <span className="flex-1 text-sm text-[#888888]">{cardLabel(item.card)}</span>
      <span className="text-xs text-[#666666]">Fija</span>
    </li>
  );
}

export function CardsPanel({
  cards,
  layout,
  onChange,
  hideWeight,
  saveState,
}: {
  cards: ReportCard[];
  layout: CardLayout | null;
  onChange: (layout: CardLayout) => void;
  hideWeight: boolean;
  saveState: "idle" | "saving" | "saved" | "error";
}) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const arranged = arrangeCards(cards, layout);
  const head = arranged.filter((a) => a.fixed && a.card.type === "opening");
  const tail = arranged.filter((a) => a.fixed && a.card.type !== "opening");
  const movable = arranged.filter((a) => !a.fixed && (a.card.type !== "exercise" || a.enabled));
  const addableExercises = arranged.filter((a) => a.card.type === "exercise" && !a.enabled);

  const current = (): CardLayout => ({
    order: arranged.filter((a) => !a.fixed).map((a) => a.key),
    enabled: Object.fromEntries(arranged.filter((a) => !a.fixed).map((a) => [a.key, a.enabled])),
  });

  function toggle(key: string) {
    const next = current();
    next.enabled[key] = !next.enabled[key];
    onChange(next);
  }

  function addExercise(key: string) {
    const next = current();
    next.enabled[key] = true;
    // Al final de la lista visible (antes de las apagadas que no se listan).
    next.order = [...movable.map((a) => a.key), key, ...next.order.filter((k) => k !== key && !movable.some((m) => m.key === k))];
    onChange(next);
  }

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const keys = movable.map((a) => a.key);
    const from = keys.indexOf(String(e.active.id));
    const to = keys.indexOf(String(e.over.id));
    if (from < 0 || to < 0) return;
    const moved = arrayMove(keys, from, to);
    const next = current();
    next.order = [...moved, ...next.order.filter((k) => !moved.includes(k))];
    onChange(next);
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-[#1e1e1e] bg-[#111111] p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-white">Tarjetas</h2>
          <p className="text-xs text-[#888888]">Prendé, apagá y arrastrá para ordenar. La vista previa se actualiza sola.</p>
        </div>
        <span className="shrink-0 text-xs text-[#888888]" aria-live="polite">
          {saveState === "saving" ? "Guardando…" : saveState === "saved" ? "Guardado ✓" : saveState === "error" ? "No se pudo guardar" : ""}
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {head.map((item) => (
          <FixedRow key={item.key} item={item} />
        ))}
      </ul>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={movable.map((a) => a.key)} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-2">
            {movable.map((item) => (
              <Row key={item.key} item={item} onToggle={() => toggle(item.key)} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <ul className="flex flex-col gap-2">
        {tail.map((item) => (
          <FixedRow key={item.key} item={item} />
        ))}
      </ul>

      {addableExercises.length > 0 && (
        <div className="flex flex-col gap-1">
          <label htmlFor="add-exercise-card" className="text-xs text-[#888888]">
            Agregar el gráfico de un ejercicio
          </label>
          <NativeSelect
            id="add-exercise-card"
            value=""
            onChange={(e) => {
              if (e.target.value) addExercise(e.target.value);
            }}
          >
            <option value="">Elegí un ejercicio</option>
            {addableExercises.map((a) => (
              <option key={a.key} value={a.key}>
                {a.card.type === "exercise" ? a.card.exercise : cardLabel(a.card)}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
      {hideWeight && (
        <p className="text-xs text-[#888888]">
          Peso: no disponible porque este cliente tiene “No mostrar peso en reportes”.
        </p>
      )}
      <p className="text-xs text-[#888888]">La tarjeta “Solo lo ves vos” nunca le llega al cliente.</p>
    </section>
  );
}
