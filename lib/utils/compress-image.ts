// Fotos de progreso (jul-2026): comprimir en el cliente ANTES de subir —
// nunca el archivo original de la cámara (puede pesar 5-10MB en un
// iPhone moderno). Reescala al lado mayor (1200px por default) y
// reencodea siempre como JPEG calidad 0.8, sea cual sea el formato
// original — así el servidor solo necesita validar UNA firma de archivo,
// no una lista de formatos.
export async function compressImage(
  file: File,
  maxSide = 1200,
  quality = 0.8
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("No se pudo procesar la imagen.");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No se pudo comprimir la imagen."))),
      "image/jpeg",
      quality
    );
  });
}
