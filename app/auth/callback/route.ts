import { NextResponse, type NextRequest } from "next/server";
import { createAuthClient } from "@/lib/auth";

// Powrót z logowania przez Google.
// Google → Supabase → tutaj, z jednorazowym kodem w adresie (?code=...).
// Serwer wymienia kod na sesję (ciasteczka) i przenosi do czatu.
// Gdy coś pójdzie nie tak albo ktoś kliknie „Anuluj” u Google — wracamy na /login z komunikatem.

// Przyjmujemy tylko ścieżki wewnątrz aplikacji, np. "/upload" — nigdy "//inna-strona.pl" ani "https://…".
function safePath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = safePath(url.searchParams.get("next"));

  const failed = new URL("/login", url.origin);
  failed.searchParams.set("blad", "google");

  if (!code) return NextResponse.redirect(failed);

  const supabase = await createAuthClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("Logowanie przez Google nie powiodło się:", error.message);
    return NextResponse.redirect(failed);
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
