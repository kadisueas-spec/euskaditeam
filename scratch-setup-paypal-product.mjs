// Script de una sola corrida: crea el Product único de PayPal ("Opción A"
// acordada) si todavía no existe. Alternativa manual a que lo cree
// generatePaymentLink() la primera vez que un coach genera un link — sirve
// para tenerlo listo de antemano en vez de que el primer intento del coach
// se corte pidiendo agregar la env var.
//
// node scratch-setup-paypal-product.mjs
import fs from "fs";

const envPath = ".env.local";
const env = fs.readFileSync(envPath, "utf8");
const get = (key) => env.match(new RegExp(`^${key}=(.*)$`, "m"))?.[1]?.trim();

const existing = get("PAYPAL_PRODUCT_ID");
if (existing) {
  console.log(`PAYPAL_PRODUCT_ID ya existe: ${existing} — no se crea uno nuevo.`);
  process.exit(0);
}

const clientId = get("PAYPAL_CLIENT_ID");
const clientSecret = get("PAYPAL_CLIENT_SECRET");
const mode = get("PAYPAL_MODE") === "live" ? "live" : "sandbox";
const BASE = mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
const tokenRes = await fetch(`${BASE}/v1/oauth2/token`, {
  method: "POST",
  headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
  body: "grant_type=client_credentials",
});
if (!tokenRes.ok) {
  console.error("No se pudo autenticar con PayPal:", await tokenRes.text());
  process.exit(1);
}
const { access_token } = await tokenRes.json();

const productRes = await fetch(`${BASE}/v1/catalogs/products`, {
  method: "POST",
  headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "Euskadi Team - Entrenamiento Personalizado",
    type: "SERVICE",
    category: "EXERCISE_AND_FITNESS",
  }),
});
if (!productRes.ok) {
  console.error("No se pudo crear el producto:", await productRes.text());
  process.exit(1);
}
const product = await productRes.json();

console.log(`\nProducto creado en PayPal (${mode}): ${product.id}`);
console.log(`\nAgregá esta línea a .env.local y a Vercel:\n`);
console.log(`PAYPAL_PRODUCT_ID=${product.id}\n`);
