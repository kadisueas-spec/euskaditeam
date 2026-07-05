import { createClient } from "@/lib/supabase/server";

export type PendingInviteCode = {
  code: string;
  createdAt: string;
};

export async function getPendingInviteCodes(): Promise<PendingInviteCode[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("invite_codes")
    .select("code, created_at")
    .eq("created_by", user.id)
    .eq("role", "client")
    .is("used_by", null)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => ({
    code: row.code,
    createdAt: row.created_at,
  }));
}
