import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastState = { type: "success" | "error"; message: string };

// Toast simple, controlado desde afuera (show/hide + auto-dismiss vive en
// quien lo usa) — no hace falta un provider global todavía, un solo
// consumidor por ahora (cambio de contraseña).
export function Toast({ type, message }: ToastState) {
  const isSuccess = type === "success";
  return (
    <div
      role="status"
      className={cn(
        "animate-fade-in-up fixed inset-x-4 bottom-20 z-50 mx-auto flex max-w-sm items-center gap-3 rounded-2xl border p-4 text-sm font-medium shadow-[0_8px_24px_rgba(0,0,0,0.4)]",
        isSuccess
          ? "border-emerald-500/30 bg-[#111111] text-emerald-400"
          : "border-[#e8001c]/30 bg-[#111111] text-[#e8001c]"
      )}
    >
      {isSuccess ? (
        <CheckCircle2 className="size-5 shrink-0" />
      ) : (
        <XCircle className="size-5 shrink-0" />
      )}
      <span className="text-[#f5f5f5]">{message}</span>
    </div>
  );
}
