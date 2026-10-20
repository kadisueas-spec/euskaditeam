// Límite de subida de archivos (oct-2026). Las subidas (fotos de progreso,
// PDFs de nutrición) pasan por Server Actions, y el cuerpo de un Server
// Action tiene un tope: 1 MB por default en Next (subido a 4 MB en
// next.config.ts, experimental.serverActions.bodySizeLimit) y 4,5 MB
// máximo en una función de Vercel — por encima de eso el pedido se corta
// antes de llegar a la acción, sin un error entendible. Por eso el límite
// de la app es 4 MB y se chequea en el navegador ANTES de enviar.
// Para archivos más pesados habría que subir directo del navegador al
// Storage (URL firmada de subida) en vez de pasar por el Server Action.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_UPLOAD_LABEL = "4 MB";

export function formatFileSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
