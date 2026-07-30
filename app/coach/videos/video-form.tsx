"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { VIDEO_CATEGORIES, VIDEO_CATEGORY_LABEL } from "@/lib/constants/videos";
import type { ClientOption } from "@/lib/supabase/routines";
import type { CoachVideoDetail } from "@/lib/supabase/videos";
import type { VideoFormState } from "./actions";

type VideoFormAction = (state: VideoFormState, formData: FormData) => Promise<VideoFormState>;

export function VideoForm({
  action,
  clients,
  initialData,
}: {
  action: VideoFormAction;
  clients: ClientOption[];
  initialData?: CoachVideoDetail;
}) {
  const [state, formAction, pending] = useActionState<VideoFormState, FormData>(
    action,
    undefined
  );

  const [isGeneral, setIsGeneral] = useState(initialData?.isGeneral ?? false);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(
    () => new Set(initialData?.assignedClientIds ?? [])
  );

  function toggleClient(id: string) {
    setAssignedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Título</Label>
        <Input
          id="title"
          name="title"
          required
          defaultValue={initialData?.title}
          placeholder="Ej: Qué es el RIR"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Descripción corta</Label>
        <Textarea
          id="description"
          name="description"
          rows={2}
          defaultValue={initialData?.description ?? undefined}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="youtube_url">Link de YouTube</Label>
        <Input
          id="youtube_url"
          name="youtube_url"
          type="url"
          required
          defaultValue={
            initialData?.youtubeId
              ? `https://www.youtube.com/watch?v=${initialData.youtubeId}`
              : undefined
          }
          placeholder="https://www.youtube.com/watch?v=..."
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="category">Categoría</Label>
        <NativeSelect id="category" name="category" defaultValue={initialData?.category ?? ""}>
          <option value="" disabled>
            Elegir categoría
          </option>
          {VIDEO_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {VIDEO_CATEGORY_LABEL[cat]}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Visibilidad</Label>
        <div className="flex flex-col gap-2">
          <label className="flex min-h-[44px] cursor-pointer items-start gap-2.5 rounded-2xl border border-[#1e1e1e] bg-white/[0.02] p-3 text-sm has-[:checked]:border-[#e8001c] has-[:checked]:bg-[#e8001c]/5">
            <input
              type="radio"
              name="visibility"
              value="general"
              checked={isGeneral}
              onChange={() => setIsGeneral(true)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium text-white">General</span>
              <br />
              <span className="text-xs text-[#888888]">
                Lo ven todos tus clientes.
              </span>
            </span>
          </label>
          <label className="flex min-h-[44px] cursor-pointer items-start gap-2.5 rounded-2xl border border-[#1e1e1e] bg-white/[0.02] p-3 text-sm has-[:checked]:border-[#e8001c] has-[:checked]:bg-[#e8001c]/5">
            <input
              type="radio"
              name="visibility"
              value="assigned"
              checked={!isGeneral}
              onChange={() => setIsGeneral(false)}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium text-white">Asignado</span>
              <br />
              <span className="text-xs text-[#888888]">
                Solo lo ve el cliente (o los clientes) que elijas.
              </span>
            </span>
          </label>
        </div>
      </div>

      {!isGeneral && (
        <div className="flex flex-col gap-2">
          <Label>Clientes</Label>
          {clients.length === 0 ? (
            <p className="text-sm text-[#888888]">Todavía no tenés clientes cargados.</p>
          ) : (
            <div className="flex max-h-72 flex-col gap-2 overflow-y-auto rounded-2xl border border-[#1e1e1e] p-2">
              {clients.map((c) => (
                <label
                  key={c.id}
                  className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-xl px-2 has-[:checked]:bg-white/5"
                >
                  <input
                    type="checkbox"
                    name="assigned_client_ids"
                    value={c.id}
                    checked={assignedIds.has(c.id)}
                    onChange={() => toggleClient(c.id)}
                  />
                  <span className="text-sm text-white">{c.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending && <Spinner size="sm" className="border-white/30 border-t-white" />}
          {pending ? "Guardando..." : "Guardar"}
        </Button>
        <Link href="/coach/videos" className={buttonVariants({ variant: "outline" })}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
