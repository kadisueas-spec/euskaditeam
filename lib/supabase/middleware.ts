import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ROLE_ROUTES: Record<string, "coach" | "client"> = {
  "/coach": "coach",
  "/client": "client",
};

// Headers internos para compartir el resultado de ESTA validación con las
// Server Components que renderizan la página, en vez de que cada una llame
// a auth.getUser() por su cuenta (eso eran 3 validaciones separadas por
// navegación: proxy + getCurrentProfile + getCurrentClientRecord, cada una
// un viaje real a Supabase). Siempre se pisan/borran acá, nunca se agregan
// condicionalmente, así un cliente no puede inyectar sus propios valores.
const AUTH_HEADERS = [
  "x-user-id",
  "x-user-email",
  "x-user-role",
  "x-user-full-name",
] as const;

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function updateSession(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);

  // Bug encontrado jul-2026 (causa raíz de fondo del cuelgue en "Iniciar
  // entrenamiento"): la versión anterior armaba un NextResponse nuevo en
  // cada paso (uno al principio, uno dentro de setAll, uno más al final) y
  // el último SIEMPRE ganaba — si getUser() refrescaba el access token
  // (típico al volver a abrir la app después de un rato), las cookies
  // refrescadas quedaban colgadas en un response intermedio que se
  // descartaba, y el navegador nunca recibía la sesión nueva. La siguiente
  // llamada (por ej. el Server Action de "Iniciar entrenamiento") volvía a
  // intentar refrescar con un refresh token ya usado -> fallaba -> a veces
  // eso alcanzaba para que la llamada nunca resolviera bien del lado del
  // cliente. Ahora las cookies a setear se juntan en un array y se aplican
  // una sola vez, al final, sobre el response que efectivamente se
  // devuelve (sea el de éxito o el de redirect a /login).
  let cookiesToSet: CookieToSet[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookies) {
          cookies.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToSet = cookies;
        },
      },
    }
  );

  // IMPORTANT: getUser() revalidates the token against the Supabase Auth
  // server on every request, unlike getSession() which only trusts the cookie.
  // Esta es la ÚNICA validación de sesión por navegación en toda la app.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    requestHeaders.set("x-user-id", user.id);
    requestHeaders.set("x-user-email", user.email ?? "");
    requestHeaders.set("x-user-role", (user.user_metadata?.role as string) ?? "");
    requestHeaders.set(
      "x-user-full-name",
      (user.user_metadata?.full_name as string) ?? ""
    );
  } else {
    AUTH_HEADERS.forEach((h) => requestHeaders.delete(h));
  }

  const { pathname } = request.nextUrl;
  const requiredRole = Object.entries(ROLE_ROUTES).find(([prefix]) =>
    pathname.startsWith(prefix)
  )?.[1];

  if (requiredRole) {
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      const redirect = NextResponse.redirect(loginUrl);
      cookiesToSet.forEach(({ name, value, options }) =>
        redirect.cookies.set(name, value, options)
      );
      return redirect;
    }

    const role = user.user_metadata?.role;
    if (role !== requiredRole) {
      const redirect = NextResponse.redirect(new URL("/login", request.url));
      cookiesToSet.forEach(({ name, value, options }) =>
        redirect.cookies.set(name, value, options)
      );
      return redirect;
    }
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  cookiesToSet.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options)
  );
  return response;
}
