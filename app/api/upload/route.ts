import { hasSession } from "@/lib/session";
import { DATABASE_MISSING, isDatabaseConfigured } from "@/lib/supabase";
import { isModelConfigured } from "@/lib/model";
import { KnowledgeError, MAX_CONTENT, MAX_TITLE, saveDocument } from "@/lib/knowledge";

// Formularz /upload: tytuł + treść -> dokument w tabeli documents i fragmenty w tabeli chunks.
export async function POST(req: Request) {
  // Najpierw sesja. Bez niej nie dotykamy bazy.
  if (!(await hasSession())) {
    return Response.json({ error: "Brak dostępu. Zaloguj się hasłem." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const content = typeof body?.content === "string" ? body.content.trim() : "";

  if (!title) return Response.json({ error: "Wpisz tytuł dokumentu." }, { status: 400 });
  if (!content) return Response.json({ error: "Wklej treść dokumentu." }, { status: 400 });
  if (title.length > MAX_TITLE) {
    return Response.json({ error: `Tytuł jest za długi (limit ${MAX_TITLE} znaków).` }, { status: 400 });
  }
  if (content.length > MAX_CONTENT) {
    return Response.json(
      { error: `Treść jest za długa (limit ${MAX_CONTENT.toLocaleString("pl-PL")} znaków).` },
      { status: 400 },
    );
  }

  if (!isDatabaseConfigured()) {
    return Response.json({ error: DATABASE_MISSING }, { status: 500 });
  }
  if (!isModelConfigured()) {
    return Response.json({ error: "Brak OPENROUTER_API_KEY w konfiguracji." }, { status: 500 });
  }

  try {
    const { chunks } = await saveDocument(title, content);
    return Response.json({ title, chunks });
  } catch (error) {
    console.error("Import dokumentu nie powiódł się:", error);
    if (error instanceof KnowledgeError) {
      return Response.json({ error: error.message }, { status: 502 });
    }
    return Response.json(
      {
        error:
          "Nie udało się zapisać dokumentu w bazie wiedzy. Sprawdź, czy w Supabase istnieją tabele " +
          "documents i chunks (warsztat 1), i spróbuj ponownie.",
      },
      { status: 500 },
    );
  }
}
