"use client";

import { ErrorState } from "@/components/error-state";

// Cubre las rutas públicas (/, /login, /register, /forgot-password) y
// cualquier otra fuera de /coach y /client, que tienen su propio error.tsx.
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState error={error} reset={reset} homeHref="/" />;
}
