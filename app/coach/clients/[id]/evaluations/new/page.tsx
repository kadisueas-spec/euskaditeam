import { notFound } from "next/navigation";
import { FadeIn } from "@/components/motion/fade-in";
import { getClientDetail } from "@/lib/supabase/clients";
import { getClientBodyInfo } from "@/lib/supabase/anthropometrics";
import { EvaluationWizard } from "./evaluation-wizard";

export default async function NewEvaluationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [client, bodyInfo] = await Promise.all([
    getClientDetail(id),
    getClientBodyInfo(id),
  ]);

  if (!client) notFound();

  return (
    <FadeIn className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="font-display text-4xl tracking-wide text-[#f5f5f5] uppercase">
          Nueva evaluación
        </h1>
        <div className="mt-1.5 h-0.5 w-10 bg-[#e8001c]" />
        <p className="text-sm text-[#888888]">{client.fullName ?? client.email}</p>
      </div>
      <EvaluationWizard clientId={id} bodyInfo={bodyInfo} />
    </FadeIn>
  );
}
