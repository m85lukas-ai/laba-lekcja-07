import { createBrowserClient } from "@supabase/ssr";

// Klient Supabase dla przeglądarki: logowanie, rejestracja i wylogowanie.
// Używa tylko publicznego klucza publishable. Sesję zapisuje w ciasteczkach,
// dzięki czemu serwer (lib/auth.ts) widzi tę samą osobę.
export function createBrowserAuthClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
