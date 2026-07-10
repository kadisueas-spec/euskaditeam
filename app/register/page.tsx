import { AuthHero } from "@/components/auth/auth-hero";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "./register-form";

export default function RegisterPage() {
  return (
    <main className="flex h-[var(--app-height,100dvh)] flex-col bg-[#080808]">
      <AuthHero subtitle="Sumate al equipo" />
      <AuthCard>
        <RegisterForm />
      </AuthCard>
    </main>
  );
}
