import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Role } from "@/lib/auth";

/**
 * Server client for React Server Components, server actions and route
 * handlers. Runs as the signed-in user, so RLS applies. This is the client you
 * want almost everywhere — reach for the service-role client only where a
 * request genuinely must bypass RLS, and then only inside app/api/**.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Middleware refreshes the session, so this is safe to swallow.
          }
        },
      },
    },
  );
}

/**
 * Resolves the signed-in user and their role in one call.
 *
 * Always uses getUser(), never getSession(). getSession() reads the cookie
 * without verifying it against the auth server, so it can be forged. On the
 * server, only getUser() is trustworthy.
 */
export async function getCurrentUser(): Promise<
  { id: string; role: Role; fullName: string } | null
> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return {
    id: user.id,
    role: profile.role as Role,
    fullName: profile.full_name as string,
  };
}
