import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { BOT_NAME } from "@/lib/persona";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import UploadForm from "../components/UploadForm";

// Baza wiedzy: tu wklejasz dokumenty (cennik, FAQ, regulamin), z których odpowiada agent.
async function Gate() {
  await connection();
  // Najpierw sesja. Bez niej — ekran hasła.
  // Kto jest zalogowany, ustala serwer (zweryfikowana sesja Supabase). Bez konta — strona logowania.
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="card">
      <header>
        <h1>Baza wiedzy</h1>
        <nav className="nav">
          <Link href="/">← Wróć do czatu</Link>
        </nav>
      </header>
      <p className="muted">
        Wklej dokument. Każdy akapit (tekst oddzielony pustą linią) zapisze się jako osobny fragment.
      </p>
      <UploadForm />
    </div>
  );
}

export default function UploadPage() {
  return (
    <main className="app">
      <Suspense fallback={<p className="muted">Ładowanie…</p>}>
        <Gate />
      </Suspense>
    </main>
  );
}
