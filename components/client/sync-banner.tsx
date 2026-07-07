"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { countPendingSets } from "@/lib/offline/workout-store";
import { syncPendingWorkouts } from "@/lib/offline/sync-workouts";

type SyncState = "idle" | "syncing" | "done";

export function SyncBanner() {
  const [state, setState] = useState<SyncState>("idle");

  useEffect(() => {
    let cancelled = false;

    async function runSync() {
      if (!navigator.onLine) return;
      const pendingCount = await countPendingSets();
      if (pendingCount === 0 || cancelled) return;

      setState("syncing");
      const result = await syncPendingWorkouts();
      if (cancelled) return;

      if (result.synced > 0) {
        setState("done");
        setTimeout(() => {
          if (!cancelled) setState("idle");
        }, 3000);
      } else {
        setState("idle");
      }
    }

    runSync();

    window.addEventListener("online", runSync);
    return () => {
      cancelled = true;
      window.removeEventListener("online", runSync);
    };
  }, []);

  if (state === "idle") return null;

  if (state === "syncing") {
    return (
      <div className="flex min-h-[36px] items-center justify-center gap-2 bg-white/10 px-4 py-1.5 text-center text-xs font-medium text-[#888888]">
        <RefreshCw className="size-3.5 shrink-0 animate-spin" />
        Sincronizando tu entrenamiento...
      </div>
    );
  }

  return (
    <div className="flex min-h-[36px] items-center justify-center gap-2 bg-green-500/15 px-4 py-1.5 text-center text-xs font-medium text-green-400">
      <CheckCircle2 className="size-3.5 shrink-0" />
      Todo sincronizado ✓
    </div>
  );
}
