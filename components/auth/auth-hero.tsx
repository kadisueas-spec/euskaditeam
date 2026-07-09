import Image from "next/image";

// Sección superior compartida por login, registro y recuperar contraseña:
// degradado radial (rojo en el centro, donde está el tridente, apagando a
// negro hacia los bordes) — antes era un degradado lineal negro->rojo de
// arriba a abajo, pero eso dejaba la mitad superior mucho más negra que la
// inferior y el tridente (centrado en la caja) se leía descentrado dentro
// del "panel rojo". El radial resuelve esto: el rojo siempre irradia desde
// el punto exacto donde está el tridente, así que se percibe centrado sin
// importar el tamaño de la caja. pt-safe-area para que el notch/isla
// dinámica del iPhone no tape el logo. El tridente es el objeto central de
// la pantalla (grande, con glow rojo propio); el wordmark pasa a ser un
// lockup chico debajo, tipo firma, en Anton (font-hero) — excepción
// puntual a Bebas Neue solo para este wordmark, ver DESIGN.md.
export function AuthHero({ subtitle }: { subtitle: string }) {
  return (
    <div
      className="relative flex shrink-0 flex-col items-center justify-center gap-4 overflow-hidden px-6 pt-[calc(env(safe-area-inset-top)+2.75rem)] pb-11 text-center"
      style={{
        background:
          "radial-gradient(circle at 50% 50%, #2a0508 0%, #1a0306 45%, #080808 100%)",
      }}
    >
      <div className="absolute top-1/2 left-1/2 size-88 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#e8001c]/35 blur-[100px]" />
      <Image
        src="/brand/euskadi-logo.png"
        alt="Euskadi Team"
        width={228}
        height={228}
        priority
        className="relative drop-shadow-[0_0_36px_rgba(232,0,28,0.45)]"
      />
      <div className="relative">
        <h1 className="font-hero text-4xl tracking-wide text-white uppercase">
          Euskadi Team
        </h1>
        <p className="mt-1 text-sm text-[#c9c9c9]">{subtitle}</p>
      </div>
    </div>
  );
}
