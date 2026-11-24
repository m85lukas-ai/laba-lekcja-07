import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AUTH_MISSING, getCurrentUser, isAuthConfigured } from "@/lib/auth";
import { BOT_NAME } from "@/lib/persona";
import LoginForm from "../components/LoginForm";

const GOOGLE_ERROR =
  "Logowanie przez Google nie udało się albo zostało anulowane. Spróbuj ponownie albo zaloguj się e-mailem.";

// Strona logowania i rejestracji. Kto jest już zalogowany, wraca do czatu.
async function Gate({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  await connection();
  if (!isAuthConfigured()) {
    return (
      <div className="card login">
        <h1>{BOT_NAME}</h1>
        <p className="error">{AUTH_MISSING}</p>
      </div>
    );
  }
  if (await getCurrentUser()) redirect("/");

  // ?blad=google ustawia trasa /auth/callback. Pokazujemy tylko nasz stały tekst, nie treść z adresu.
  const params = await searchParams;
  const initialError = params.blad === "google" ? GOOGLE_ERROR : "";
  return <LoginForm botName={BOT_NAME} initialError={initialError} />;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="app">
      <Suspense fallback={<p className="muted">Ładowanie…</p>}>
        <Gate searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
