import { notFound } from "next/navigation";
import { getClientReport } from "@/lib/supabase/progress-reports";
import { ReportScreen } from "./report-screen";

export default async function ClientReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getClientReport(id);
  if (!report) notFound();
  return <ReportScreen report={report} />;
}
