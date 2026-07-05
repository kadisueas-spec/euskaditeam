"use client";

import { useActionState, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateInviteCode, type InviteState } from "./actions";

export function InviteForm() {
  const [state, action, pending] = useActionState<InviteState, FormData>(
    generateInviteCode,
    undefined
  );
  const [copied, setCopied] = useState(false);

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Generando..." : "Generar código de invitación"}
      </Button>

      {state && "success" in state && (
        <div className="flex items-center gap-2 rounded-2xl border border-[#e8001c]/30 bg-white/5 px-4 py-3">
          <span className="font-display text-3xl tracking-widest text-[#e8001c]">
            {state.code}
          </span>
          <button
            type="button"
            onClick={() => copyCode(state.code)}
            aria-label="Copiar código"
            className="ml-auto flex size-8 items-center justify-center rounded-md text-[#888888] transition-transform active:scale-90 hover:bg-white/10 hover:text-white"
          >
            {copied ? (
              <Check className="size-4" />
            ) : (
              <Copy className="size-4" />
            )}
          </button>
        </div>
      )}

      {state && "error" in state && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}
    </form>
  );
}
