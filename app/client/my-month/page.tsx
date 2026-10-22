import { redirect } from "next/navigation";

// Mi Mes se integró en el reporte mensual (oct-2026). Los links viejos
// (push "Terminaste el mes", favoritos) van al historial de reportes.
export default function MyMonthPage() {
  redirect("/client/progress/reports");
}
