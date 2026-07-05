import * as React from "react"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"

// <select> nativo en vez del Select custom de Base UI: en iPhone real
// (Safari e instalada como PWA) el Select de Base UI no abre al tocar —
// usa una técnica de apertura por evento "mousedown" con lógica especial
// para distinguir touch de mouse que Safari no sintetiza de forma
// confiable. El <select> nativo abre el picker propio del sistema
// operativo, así que es 100% confiable al toque sin depender de eventos
// sintéticos de ningún tipo.
function NativeSelect({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        data-slot="native-select"
        className={cn(
          "flex h-9 w-full appearance-none items-center rounded-lg border border-input bg-transparent py-2 pr-8 pl-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}

export { NativeSelect }
