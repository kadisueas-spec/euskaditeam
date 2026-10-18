// Importa los GIFs de ExerciseDB al Storage de Supabase y completa
// exercises.gif_url (oct-2026). Se corre UNA vez, a mano, desde la raíz del
// repo — no es parte de la app ni del build.
//
// Qué hace:
//   1. Crea el bucket público "exercise-gifs" si no existe.
//   2. Por cada GIF del mapeo: lo baja de ExerciseDB y lo sube a
//      exercise-gifs/exercisedb/<id>.gif (si ya está subido, lo saltea).
//   3. Actualiza exercises.gif_url con la URL pública del Storage, por nombre
//      exacto del ejercicio (incluye duplicados con el mismo nombre).
//
// Es idempotente: se puede volver a correr sin duplicar nada.
//
// Uso (PowerShell, desde C:\Users\Luis\Desktop\fitcoach):
//   $env:SUPABASE_URL = "https://<proyecto>.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY = "<service role key>"
//   node scripts/import-exercise-gifs.mjs --dry-run   # solo muestra qué haría
//   node scripts/import-exercise-gifs.mjs             # lo hace de verdad
//
// La service role key se lee de la variable de entorno: nunca se escribe en
// este archivo ni se commitea.

import { createClient } from "@supabase/supabase-js";

const BUCKET = "exercise-gifs";
const SOURCE = "https://static.exercisedb.dev/media";
const DRY_RUN = process.argv.includes("--dry-run");

// [nombre del ejercicio en nuestra base, id del GIF en ExerciseDB]
// 92 de 97: los 5 sin GIF (Plancha frontal, Hollow body hold, Dragon flag,
// Remo ergométrico, Patada de glúteo en cuadrupedia) quedan con YouTube.
const MAPPING = [
  ["Ab rollout en barra", "7M66AVi"], // Barbell Rollout
  ["Bicicleta abdominal", "1ZFqTDN"], // Bicycle Crunch
  ["Crunch abdominal", "TFqbd8t"], // crunch floor
  ["Crunch en el suelo", "TFqbd8t"], // crunch floor
  ["Crunch en polea alta", "WW95auq"], // cable kneeling crunch
  ["Crunch inverso", "nCU1Ekp"], // reverse crunch
  ["Elevación de piernas colgado", "I3tsCnC"], // hanging leg raise
  ["Elevación de piernas en paralelas", "weoDEpH"], // Captains Chair Straight-Leg Raise
  ["Plancha lateral", "RKjH6Lt"], // side bridge
  ["Rueda abdominal (ab wheel rollout)", "NAgVB3t"], // wheel rollout
  ["Sit-up", "Bn6TXyO"], // sit-up
  ["Tijeras", "UVo2Qs2"], // flutter kicks
  ["Toque de talones", "qaZVsGk"], // alternate heel touchers
  ["Aductores en máquina", "oHsrypV"], // Machine Seated Hip Adduction
  ["Curl con barra", "25GPyDY"], // barbell curl
  ["Curl con barra Z", "6TG6x2w"], // EZ-Bar Curl
  ["Curl con mancuernas alterno", "BU15nH4"], // dumbbell alternate biceps curl
  ["Curl concentrado", "gvsWLQw"], // dumbbell concentration curl
  ["Curl en banco Scott (predicador)", "qOgPVf6"], // barbell preacher curl
  ["Curl en polea baja", "G08RZcQ"], // cable curl
  ["Curl martillo", "2NpxjC1"], // dumbbell hammer curl
  ["Bicicleta elíptica", "rjtuP6X"], // walk elliptical cross trainer
  ["Bicicleta estática", "a8VDgLw"], // stationary bike walk
  ["Burpees", "dK9394r"], // burpee
  ["Caminata en cinta", "rjiM4L3"], // walking on incline treadmill
  ["Escaladora", "j9Q5crt"], // walking on stepmill
  ["Mountain climbers", "RJgzwny"], // mountain climber
  ["Salto a la soga", "e1e76I2"], // jump rope
  ["Sprints", "oLrKqDH"], // run
  ["Step", "aXtJhlg"], // dumbbell step-up
  ["Trote en cinta", "y5p0H8a"], // run (equipment)
  ["Extensión de cuádriceps en máquina", "my33uHU"], // Machine Leg Extension
  ["Hack squat en máquina", "Qa55kX1"], // sled hack squat
  ["Prensa de piernas (leg press)", "10Z2DXU"], // sled 45° leg press
  ["Sentadilla búlgara", "qx4fgX7"], // dumbbell single leg split squat
  ["Sentadilla con barra", "iYzB0Cz"], // Barbell Full Squat
  ["Sentadilla en Smith", "jFtipLl"], // smith squat
  ["Sentadilla frontal", "zG0zs85"], // barbell front squat
  ["Sentadilla goblet", "yn8yg1r"], // dumbbell goblet squat
  ["Zancadas con mancuernas", "RRWFUcw"], // dumbbell lunge
  ["Elevaciones frontales con mancuernas", "3eGE2JC"], // dumbbell front raise
  ["Elevaciones laterales con mancuernas", "DsgkuIt"], // dumbbell lateral raise
  ["Elevaciones laterales en polea", "goJ6ezq"], // cable lateral raise
  ["Face pull en polea", "wqNPGCg"], // cable rear delt row (with rope)
  ["Pájaros / elevaciones posteriores inclinado", "v1qBec9"], // dumbbell rear lateral raise
  ["Press Arnold", "eOrFCnx"], // dumbbell arnold press
  ["Press de hombros con mancuernas", "znQUdHY"], // dumbbell seated shoulder press
  ["Press de hombros en máquina", "67n3r98"], // Machine Shoulder Press
  ["Press militar con barra", "kTbSH9h"], // barbell seated overhead press
  ["Dominadas (pull-ups)", "lBDjFxJ"], // pull-up
  ["Jalón al pecho agarre ancho", "eYnzaCm"], // cable bar lateral pulldown
  ["Jalón al pecho agarre cerrado supino", "xBYcQHj"], // cable underhand pulldown
  ["Pull-over con mancuerna", "9XjtHvS"], // dumbbell pullover
  ["Pullover en polea alta", "x69MAlq"], // cable straight arm pulldown
  ["Remo con barra", "eZyBC3j"], // barbell bent over row
  ["Remo con mancuerna a un brazo", "C0MA9bC"], // Dumbbell Single-Arm Bent-Over Row
  ["Remo en máquina", "7I6LNUG"], // Machine Seated Row
  ["Remo en polea baja sentado", "fUBheHs"], // cable seated row
  ["Remo invertido (Australian pull-up)", "bZGHsAZ"], // inverted row
  ["Remo T", "aaXr7ld"], // Machine T Bar Row
  ["Elevación de talones de pie", "ykUOVze"], // Machine Standing Calf Raise
  ["Elevación de talones en prensa", "ykHcWme"], // sled calf press on leg press
  ["Elevación de talones sentado", "bOOdeyc"], // Machine Seated Calf Raise
  ["Abducción de cadera en máquina", "CHpahtl"], // Machine Seated Hip Abduction
  ["Hip thrust con barra", "qKBpF7I"], // barbell glute bridge
  ["Patada de glúteo en polea", "Kpajagk"], // cable standing hip extension
  ["Puente de glúteos", "u0cNiij"], // low glute bridge on floor
  ["Step up con mancuernas", "aXtJhlg"], // dumbbell step-up
  ["Buenos días (good mornings)", "XlZ4lAC"], // barbell good morning
  ["Curl de isquios acostado", "17lJ1kr"], // Machine Lying Leg Curl
  ["Curl femoral sentado en máquina", "Zg3XY7P"], // Machine Seated Leg Curl
  ["Curl femoral tumbado en máquina", "17lJ1kr"], // Machine Lying Leg Curl
  ["Peso muerto con barra", "ila4NZS"], // barbell deadlift
  ["Peso muerto rumano con barra", "wQ2c4XD"], // barbell romanian deadlift
  ["Peso muerto sumo", "KgI0tqW"], // barbell sumo deadlift
  ["Aperturas con mancuernas", "yz9nUhF"], // dumbbell fly
  ["Cruce de poleas", "0CXGHya"], // Cable Crossover
  ["Flexiones de brazos (push-ups)", "I4hDWkc"], // push-up
  ["Fondos en paralelas (para pecho)", "9WTm7dq"], // chest dip
  ["Press banca con barra", "EIeI8Vf"], // barbell bench press
  ["Press banca con mancuernas", "SpYC0Kp"], // dumbbell bench press
  ["Press en máquina (chest press)", "DOoWcnA"], // Machine Chest Press
  ["Press inclinado con barra", "3TZduzM"], // barbell incline bench press
  ["Press inclinado con mancuernas", "B3Rxp6L"], // Dumbbell Incline Bench Press
  ["Extensión de tríceps en polea alta", "3ZflifB"], // cable pushdown
  ["Extensión de tríceps en polea tras nuca", "2IxROQ1"], // cable overhead triceps extension (rope attachment)
  ["Extensión de tríceps sobre la cabeza con mancuerna", "kont8Ut"], // dumbbell seated triceps extension
  ["Fondos en banco (dips en banco)", "RrLske5"], // bench dip (knees bent)
  ["Fondos en paralelas (para tríceps)", "X6C6i5Y"], // triceps dip
  ["Patada de tríceps con mancuerna", "W6PxUkg"], // dumbbell kickback
  ["Press cerrado con barra", "J6Dx1Mu"], // barbell close-grip bench press
  ["Press francés con barra", "h8LFzo9"], // barbell lying triceps extension skull crusher
  // Segunda tanda (oct-2026): variantes que no estaban en el mapeo original.
  // Los "~" son aproximados (no hay versión exacta en ExerciseDB).
  ["Elevación de piernas tumbado", "WhuFnR7"], // lying leg raise flat bench
  ["Giro ruso (Russian twist)", "XVDdcoj"], // russian twist
  ["Prensa pendular", "Qa55kX1"], // ~ sled hack squat (no hay péndulo)
  ["Jalón unilateral con banco", "U5INZY6"], // cable single-arm pulldown
  ["Elevación de talones a una pierna con mancuerna", "1kB3Wmk"], // dumbbell single leg calf raise
  ["Elevación de talones en burrito (donkey calf raise)", "u5ESqzH"], // donkey calf raise
  ["Elevación de talones en escalón con peso corporal", "6HmFgmx"], // standing calf raise (on a staircase)
  ["Hip thrust a una pierna", "rmEukuS"], // ~ single leg bridge with outstretched leg (en el piso)
  ["Patada diagonal en polea", "Kpajagk"], // ~ cable standing hip extension (recta, no diagonal)
  ["Puente de glúteos en máquina", "qKBpF7I"], // ~ barbell glute bridge
  ["Peso muerto a una pierna con mancuerna", "gKozT8X"], // dumbbell single leg deadlift
  ["Press inclinado en smith", "5v7KYld"], // smith incline bench press
  ["Press inclinado con goma en smith", "5v7KYld"], // ~ smith incline bench press (sin goma)
];

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY (ver instrucciones arriba).");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ExerciseDB corta con 429 si se le pide muy rápido: reintenta esperando.
// Devuelve null si el GIF no existe (404) — algunos IDs del catálogo
// apuntan a un archivo que ya no está; ese ejercicio se saltea y se informa
// al final, sin cortar el resto.
async function downloadGif(id) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(`${SOURCE}/${id}.gif`);
    if (res.ok) return new Uint8Array(await res.arrayBuffer());
    if (res.status === 404) return null;
    if (res.status === 429) {
      console.log(`  429 de ExerciseDB, espero ${attempt * 20}s...`);
      await sleep(attempt * 20_000);
      continue;
    }
    throw new Error(`HTTP ${res.status} al bajar ${id}`);
  }
  throw new Error(`No se pudo bajar ${id} después de 5 intentos`);
}

async function ensureBucket() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw error;
  const existing = buckets.find((b) => b.name === BUCKET);
  if (existing) {
    if (!existing.public) {
      throw new Error(`El bucket "${BUCKET}" existe pero es privado. Hacelo público desde el Dashboard.`);
    }
    console.log(`Bucket "${BUCKET}" ya existe (público).`);
    return;
  }
  if (DRY_RUN) {
    console.log(`[dry-run] Crearía el bucket público "${BUCKET}".`);
    return;
  }
  const { error: createError } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    allowedMimeTypes: ["image/gif"],
    fileSizeLimit: "2MB",
  });
  if (createError) throw createError;
  console.log(`Bucket "${BUCKET}" creado (público).`);
}

async function alreadyUploaded() {
  const { data, error } = await supabase.storage.from(BUCKET).list("exercisedb", { limit: 1000 });
  if (error) return new Set();
  return new Set(data.map((f) => f.name));
}

async function main() {
  console.log(DRY_RUN ? "=== DRY RUN: no se sube ni se modifica nada ===\n" : "");

  // gif_url tiene que existir antes de correr esto. El chequeo pasa por la
  // API de Supabase (PostgREST), no por information_schema: si la columna
  // existe en Postgres pero PostgREST todavía no recargó su caché de
  // schema después del ALTER TABLE, responde "column not found" igual.
  // Se muestra el error real para distinguir ese caso de otros (URL o key
  // mal cargadas, red, etc.).
  const { error: columnError } = await supabase.from("exercises").select("gif_url").limit(1);
  if (columnError) {
    console.error("No se pudo leer exercises.gif_url a través de la API de Supabase.");
    console.error(`  Error: ${columnError.message}${columnError.code ? ` (código ${columnError.code})` : ""}`);
    const msg = `${columnError.message} ${columnError.code ?? ""}`.toLowerCase();
    if (msg.includes("schema cache") || msg.includes("pgrst204") || msg.includes("42703") || msg.includes("does not exist")) {
      console.error(
        "\n  Si en el SQL Editor la columna SÍ existe, es la caché de schema de la API.\n" +
          "  Corré esto en el SQL Editor y volvé a intentar en unos segundos:\n\n" +
          "    notify pgrst, 'reload schema';\n"
      );
    } else if (msg.includes("jwt") || msg.includes("api key") || msg.includes("invalid") || msg.includes("401")) {
      console.error("\n  Parece un problema de credenciales: revisá SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.");
    }
    process.exit(1);
  }

  await ensureBucket();
  const uploaded = DRY_RUN ? new Set() : await alreadyUploaded();

  const ids = [...new Set(MAPPING.map(([, id]) => id))];
  const publicUrlById = new Map();
  let uploadedCount = 0;
  let skippedCount = 0;
  // IDs cuyo GIF dio 404 en ExerciseDB: sus ejercicios no reciben gif_url
  // (siguen con YouTube) y se listan en el resumen.
  const missingIds = new Set();

  console.log(`\nGIFs a procesar: ${ids.length}`);
  for (const id of ids) {
    const path = `exercisedb/${id}.gif`;
    publicUrlById.set(id, supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
    if (uploaded.has(`${id}.gif`)) {
      skippedCount++;
      continue;
    }
    if (DRY_RUN) {
      console.log(`[dry-run] Subiría ${path}`);
      continue;
    }
    const bytes = await downloadGif(id);
    if (!bytes) {
      missingIds.add(id);
      const names = MAPPING.filter(([, i]) => i === id).map(([n]) => n).join(", ");
      console.log(`  404: ${id} no existe en ExerciseDB — se saltea (${names})`);
      continue;
    }
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "image/gif", upsert: true, cacheControl: "31536000" });
    if (error) throw new Error(`Subiendo ${path}: ${error.message}`);
    uploadedCount++;
    console.log(`  subido ${path} (${Math.round(bytes.length / 1024)} KB)`);
    await sleep(1_500);
  }

  console.log(`\nActualizando exercises.gif_url...`);
  const notFound = [];
  let updatedRows = 0;
  for (const [name, id] of MAPPING) {
    // Sin GIF subido no se escribe una URL que daría 404 en la app.
    if (missingIds.has(id)) continue;
    const gifUrl = publicUrlById.get(id);
    if (DRY_RUN) {
      const { count } = await supabase
        .from("exercises")
        .select("id", { count: "exact", head: true })
        .eq("name", name);
      if (!count) notFound.push(name);
      else console.log(`[dry-run] ${name} (${count} fila${count === 1 ? "" : "s"}) -> ${gifUrl}`);
      continue;
    }
    const { data, error } = await supabase
      .from("exercises")
      .update({ gif_url: gifUrl })
      .eq("name", name)
      .select("id");
    if (error) throw new Error(`Actualizando "${name}": ${error.message}`);
    if (!data || data.length === 0) notFound.push(name);
    updatedRows += data?.length ?? 0;
  }

  console.log(`\n=== Resumen ===`);
  if (!DRY_RUN) {
    console.log(`GIFs subidos: ${uploadedCount} (ya estaban: ${skippedCount})`);
    console.log(`Filas de exercises actualizadas: ${updatedRows}`);
  }
  if (notFound.length) {
    console.log(`Nombres SIN fila en exercises (revisar si se renombraron): ${notFound.length}`);
    for (const n of notFound) console.log(`  - ${n}`);
  } else {
    console.log("Todos los nombres del mapeo encontraron su ejercicio.");
  }
  if (missingIds.size) {
    const skipped = MAPPING.filter(([, id]) => missingIds.has(id));
    console.log(`\nEjercicios SIN subir por 404 en ExerciseDB (quedan con YouTube): ${skipped.length}`);
    for (const [name, id] of skipped) console.log(`  - ${name} (GIF ${id})`);
  }
}

main().catch((err) => {
  console.error("\nERROR:", err.message ?? err);
  process.exit(1);
});
