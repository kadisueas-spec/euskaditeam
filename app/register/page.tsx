import Image from "next/image";
import { FadeIn } from "@/components/motion/fade-in";
import { RegisterForm } from "./register-form";

export default function RegisterPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-[#080808] p-6">
      <FadeIn className="w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center gap-3">
          <div className="relative flex items-center justify-center">
            <div className="absolute size-24 rounded-full bg-[#e8001c]/20 blur-2xl" />
            <Image
              src="/brand/euskadi-logo.png"
              alt="Euskadi Team"
              width={80}
              height={80}
              priority
              className="relative"
            />
          </div>
          <div className="text-center">
            <h1 className="font-display text-4xl tracking-wide text-[#f5f5f5] uppercase">
              Crear cuenta
            </h1>
            <p className="mt-2 text-sm text-[#888888]">
              Necesitás un código de invitación para registrarte.
            </p>
          </div>
        </div>
        <RegisterForm />
      </FadeIn>
    </main>
  );
}
