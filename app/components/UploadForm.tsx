"use client";

import { useState, type FormEvent } from "react";

const MAX_CONTENT = 20_000;

// Formularz dodawania dokumentu do bazy wiedzy.
export default function UploadForm() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");

    // Puste pola sprawdzamy od razu, bez pytania serwera.
    if (!title.trim()) return setError("Wpisz tytuł dokumentu.");
    if (!content.trim()) return setError("Wklej treść dokumentu.");

    setBusy(true);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Nie udało się zapisać dokumentu. Spróbuj ponownie.");
        return;
      }
      setSuccess(`Zapisano dokument „${data.title}”: ${data.chunks} fragmentów`);
      setTitle("");
      setContent("");
    } catch {
      setError("Brak połączenia z serwerem. Sprawdź, czy działa npm run dev.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="upload-form" onSubmit={submit}>
      <label>
        Tytuł
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="np. Cennik 2026"
          maxLength={200}
        />
      </label>
      <label>
        Treść
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Wklej tekst dokumentu. Akapity oddziel pustą linią."
          maxLength={MAX_CONTENT}
          rows={14}
        />
        <span className="small">
          {content.length.toLocaleString("pl-PL")} / {MAX_CONTENT.toLocaleString("pl-PL")} znaków
        </span>
      </label>
      <button type="submit" disabled={busy}>
        {busy ? "Tworzę embeddingi i zapisuję…" : "Dodaj do bazy wiedzy"}
      </button>
      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}
    </form>
  );
}
