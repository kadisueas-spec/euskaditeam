import Stripe from "stripe";

// No apiVersion pinning: sin especificarla, el SDK usa la versión con la
// que fue publicado el paquete instalado (evita fijar a mano una versión
// que quede vieja con el tiempo).
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
