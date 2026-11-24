import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AUTH_MISSING, getCurrentUser, isAuthConfigured } from "@/lib/auth";
import { BOT_NAME } from "@/lib/persona";
import LoginForm from "../components/LoginForm";

// Strona logowania i rejestracji. Kto jest już zalogowany, wraca do czatu.
async function Gate() {
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
  return <LoginForm botName={BOT_NAME} />;
}

export default function LoginPage() {
  return (
    <main className="app">
      <Suspense fallback={<p className="muted">Ładowanie…</p>}>
        <Gate />
      </Suspense>
    </main>
  );
}
