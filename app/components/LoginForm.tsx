"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { createBrowserAuthClient } from "@/lib/auth-browser";

type Tab = "login" | "signup";
const MIN_PASSWORD = 8;

// Komunikaty Supabase (po angielsku) zamieniamy na polskie.
function polishError(error: AuthError): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Zły e-mail albo hasło.";
    case "user_already_exists":
    case "email_exists":
      return "Konto z tym adresem już istnieje. Przejdź do zakładki „Zaloguj się”.";
    case "weak_password":
      return `Hasło jest za słabe. Użyj co najmniej ${MIN_PASSWORD} znaków.`;
    case "email_address_invalid":
    case "validation_failed":
      return "Ten adres e-mail wygląda na niepoprawny.";
    case "email_not_confirmed":
      return "Adres e-mail nie jest potwierdzony. Sprawdź skrzynkę.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Za dużo prób. Odczekaj chwilę i spróbuj ponownie.";
    case "signup_disabled":
      return "Zakładanie nowych kont jest wyłączone.";
    default:
      return "Nie udało się. Spróbuj ponownie za chwilę.";
  }
}

export default function LoginForm({ botName, initialError = "" }: { botName: string; initialError?: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(initialError);
  const [googleBusy, setGoogleBusy] = useState(false);

  // Logowanie przez Google: przeglądarka idzie do Google, potem przez Supabase wraca na /auth/callback.
  // Adres powrotu budujemy z adresu, pod którym aplikacja właśnie działa (localhost albo Vercel).
  async function loginWithGoogle() {
    setError("");
    setGoogleBusy(true);
    const { error: oauthError } = await createBrowserAuthClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/` },
    });
    if (oauthError) {
      setGoogleBusy(false);
      setError("Nie udało się rozpocząć logowania przez Google. Spróbuj ponownie.");
    }
  }
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  function switchTab(next: Tab) {
    setTab(next);
    setError("");
    setInfo("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setInfo("");
    if (password.length < MIN_PASSWORD) {
      setError(`Hasło musi mieć co najmniej ${MIN_PASSWORD} znaków.`);
      return;
    }

    setBusy(true);
    const supabase = createBrowserAuthClient();
    const result =
      tab === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setBusy(false);

    if (result.error) {
      setError(polishError(result.error));
      return;
    }
    if (!result.data.session) {
      // Tak się dzieje, gdy w Supabase włączone jest potwierdzanie e-maila.
      setInfo("Konto założone. Sprawdź skrzynkę i kliknij link potwierdzający.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <form className="card login" onSubmit={submit}>
      <h1>{botName}</h1>
      <div className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "login"}
          className={tab === "login" ? "tab active" : "tab"}
          onClick={() => switchTab("login")}
        >
          Zaloguj się
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "signup"}
          className={tab === "signup" ? "tab active" : "tab"}
          onClick={() => switchTab("signup")}
        >
          Załóż konto
        </button>
      </div>
      <input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="E-mail"
        aria-label="E-mail"
        autoComplete="email"
        required
        autoFocus
      />
      <input
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder={tab === "signup" ? `Hasło (min. ${MIN_PASSWORD} znaków)` : "Hasło"}
        aria-label="Hasło"
        autoComplete={tab === "signup" ? "new-password" : "current-password"}
        required
      />
      <button type="submit" disabled={busy || !email || !password}>
        {busy ? "Chwileczkę…" : tab === "login" ? "Zaloguj się" : "Załóż konto"}
      </button>
      <p className="muted or">albo</p>
      <button type="button" className="ghost" onClick={loginWithGoogle} disabled={googleBusy}>
        {googleBusy ? "Chwileczkę…" : "Zaloguj przez Google"}
      </button>
      {error && <p className="error">{error}</p>}
      {info && <p className="muted">{info}</p>}
    </form>
  );
}
