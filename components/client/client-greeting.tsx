"use client";

import { useEffect, useState } from "react";

// Bloque 4 (jul-2026): saludo por hora — tiene que ser la hora LOCAL del
// dispositivo del cliente, no la del servidor (puede estar en otra zona
// horaria). Por eso es "use client" y se calcula recién en un efecto: si se
// calculara directo en el primer render, el server (con su propia hora)
// podría generar un saludo distinto al que calcula el navegador al
// hidratar, y React marcaría un mismatch de contenido. Arrancar en null y
// resolver en el efecto evita ese mismatch — el salto de "nada" a el saludo
// real es imperceptible.
function greetingFor(hour: number, name: string): string {
  const namePart = name ? `, ${name}` : "";
  if (hour < 6) {
    return `Sos de las pocas personas despiertas a esta hora${namePart}. Eso ya dice algo.`;
  }
  if (hour < 12) {
    return `Buenos días${namePart}. ¿Hoy entrenás?`;
  }
  if (hour < 19) {
    return `Buenas tardes${namePart}. ¿Lista/o para entrenar?`;
  }
  return `Buenas noches${namePart}. Cerrá el día con todo.`;
}

export function ClientGreeting({ name }: { name: string }) {
  const [greeting, setGreeting] = useState<string | null>(null);

  useEffect(() => {
    setGreeting(greetingFor(new Date().getHours(), name));
  }, [name]);

  if (!greeting) return null;

  return (
    <p className="font-display text-2xl tracking-wide text-[#f5f5f5]">
      {greeting}
    </p>
  );
}
