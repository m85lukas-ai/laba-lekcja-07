import "server-only"; // tylko serwer: tu ustalamy, kto jest zalogowany
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// ============================================================
// Konta użytkowników (Supabase Auth).
// Przeglądarka trzyma sesję w ciasteczkach. Serwer NIE wierzy ciasteczku na słowo:
// getUser() pyta serwer Supabase, czy sesja jest prawdziwa i ważna.
// Klucz publishable jest publiczny — sam niczego nie otwiera.
// ============================================================

export const AUTH_MISSING =
  "Brakuje NEXT_PUBLIC_SUPABASE_URL albo NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY w .env.local. " +
  "Uzupełnij je i uruchom serwer ponownie.";

export function isAuthConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

// Klient Supabase działający „jako zalogowana osoba” (sesja z ciasteczek tego zapytania).
export async function createAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error(AUTH_MISSING);

  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Strona (Server Component) nie może zapisywać ciasteczek — sesję odświeża proxy.ts.
        }
      },
    },
  });
}

// Zalogowana osoba albo null. Sesja jest weryfikowana przez Supabase przy każdym wywołaniu.
export async function getCurrentUser(): Promise<User | null> {
  if (!isAuthConfigured()) return null;
  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}
