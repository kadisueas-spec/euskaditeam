import Image from "next/image";

// Sección superior compartida por login y registro: degradado negro -> rojo
// profundo apagado con un glow detrás del logo. pt-safe-area para que el
// notch/isla dinámica del iPhone no tape el logo.
export function AuthHero({ subtitle }: { subtitle: string }) {
  return (
    <div
      className="relative flex shrink-0 flex-col items-center justify-center gap-3 overflow-hidden px-6 pt-[calc(env(safe-area-inset-top)+2.5rem)] pb-16 text-center"
      style={{
        background:
          "linear-gradient(180deg, #080808 0%, #1a0306 60%, #2a0508 100%)",
      }}
    >
      <div className="absolute top-1/2 left-1/2 size-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#e8001c]/25 blur-[70px]" />
      <Image
        src="/brand/euskadi-logo.png"
        alt="Euskadi Team"
        width={72}
        height={72}
        priority
        className="relative"
      />
      <div className="relative">
        <h1 className="font-display text-4xl tracking-wide text-white uppercase">
          Euskadi Team
        </h1>
        <p className="mt-1 text-sm text-[#c9c9c9]">{subtitle}</p>
      </div>
    </div>
  );
}
