import { createServerClient } from "@supabase/ssr";
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

export async function updateSession(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
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
  response = NextResponse.next({ request: { headers: requestHeaders } });

  const { pathname } = request.nextUrl;
  const requiredRole = Object.entries(ROLE_ROUTES).find(([prefix]) =>
    pathname.startsWith(prefix)
  )?.[1];

  if (requiredRole) {
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    const role = user.user_metadata?.role;
    if (role !== requiredRole) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return response;
}
