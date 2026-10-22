"use client";

import { useRouter } from "next/navigation";
import { ReportViewer } from "@/components/client/report-viewer";
import type { ClientReport } from "@/lib/supabase/progress-reports";

export function ReportScreen({ report }: { report: ClientReport }) {
  const router = useRouter();
  return <ReportViewer report={report} onClose={() => router.push("/client/progress/reports")} />;
}
