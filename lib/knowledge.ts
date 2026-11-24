import "server-only";
import { embed, embedMany } from "ai";
import { embeddingModel } from "./model";
import { supabase } from "./supabase";

// ============================================================
// Baza wiedzy (RAG): dokumenty dzielone na fragmenty.
// Tabele: documents (tytuł) i chunks (fragmenty z embeddingiem).
// ============================================================

export const MAX_TITLE = 200;
export const MAX_CONTENT = 20_000;
const MAX_CHUNK = 800;

// Dzieli długi akapit na kawałki do 800 znaków — zawsze na granicy zdania.
function splitLongParagraph(paragraph: string): string[] {
  const sentences = paragraph.match(/[^.!?]+(?:[.!?]+|$)/g) ?? [paragraph];
  const parts: string[] = [];
  let current = "";
  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;
    const joined = current ? `${current} ${sentence}` : sentence;
    if (joined.length > MAX_CHUNK && current) {
      parts.push(current);
      current = sentence;
    } else {
      current = joined;
    }
  }
  if (current) parts.push(current);
  return parts;
}

// Jeden akapit (tekst oddzielony pustą linią) = jeden fragment. Krótkich akapitów nie łączymy.
export function splitIntoChunks(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .flatMap((p) => (p.length > MAX_CHUNK ? splitLongParagraph(p) : [p]));
}

// Błąd, którego treść można pokazać użytkownikowi.
export class KnowledgeError extends Error {}

// pgvector przyjmuje wektor jako tekst w postaci "[0.1,0.2,…]".
function toVector(embedding: number[]): string {
  return JSON.stringify(embedding);
}

// Zapisuje dokument i jego fragmenty razem z embeddingami.
// Przy okazji uzupełnia embeddingi starszych fragmentów, które ich nie mają.
// Gdy coś się nie uda — usuwa niedokończony dokument.
export async function saveDocument(title: string, content: string): Promise<{ chunks: number }> {
  const chunks = splitIntoChunks(content);
  if (chunks.length === 0) throw new KnowledgeError("Treść nie zawiera żadnego akapitu.");

  const db = supabase();

  // 1. Starsze fragmenty bez embeddingu (np. dodane, zanim embeddingi działały).
  const { data: missing, error: missingError } = await db
    .from("chunks")
    .select("id, content")
    .is("embedding", null);
  if (missingError) throw new Error(`Nie udało się odczytać fragmentów: ${missingError.message}`);
  const old = missing ?? [];

  // 2. Embeddingi wszystkich fragmentów — nowych i starszych — jednym wywołaniem.
  //    Jeśli to się nie uda, nic jeszcze nie zapisaliśmy.
  let embeddings: number[][];
  try {
    const result = await embedMany({
      model: embeddingModel(),
      values: [...chunks, ...old.map((c) => c.content as string)],
    });
    embeddings = result.embeddings;
  } catch (error) {
    console.error("Embeddingi nie powiodły się:", error);
    throw new KnowledgeError(
      "Nie udało się utworzyć embeddingów — model embeddingów nie odpowiedział. Sprawdź nazwę " +
        "w OPENROUTER_EMBEDDING_MODEL i uruchom serwer ponownie. Dokument nie został zapisany.",
    );
  }
  const newEmbeddings = embeddings.slice(0, chunks.length);
  const oldEmbeddings = embeddings.slice(chunks.length);

  // 3. Dokument.
  const { data: doc, error: docError } = await db
    .from("documents")
    .insert({ title })
    .select("id")
    .single();
  if (docError || !doc) throw new Error(`Nie udało się zapisać dokumentu: ${docError?.message}`);

  const rows = chunks.map((chunk, index) => ({
    document_id: doc.id,
    chunk_index: index,
    content: chunk,
    embedding: toVector(newEmbeddings[index]),
  }));
  // 4. Fragmenty z embeddingami.
  const { error: chunkError } = await db.from("chunks").insert(rows);
  if (chunkError) {
    // Kasujemy dokument — dzięki „on delete cascade” znikną też ewentualne fragmenty.
    await db.from("documents").delete().eq("id", doc.id);
    throw new Error(`Nie udało się zapisać fragmentów: ${chunkError.message}`);
  }

  // 5. Uzupełniamy embeddingi starszych fragmentów.
  for (const [i, chunk] of old.entries()) {
    const { error } = await db
      .from("chunks")
      .update({ embedding: toVector(oldEmbeddings[i]) })
      .eq("id", chunk.id);
    if (error) {
      await db.from("documents").delete().eq("id", doc.id);
      throw new Error(`Nie udało się uzupełnić embeddingów starszych fragmentów: ${error.message}`);
    }
  }

  return { chunks: chunks.length };
}

export type KnowledgeHit = {
  zrodlo: string; // tytuł dokumentu = nazwa źródła
  tresc: string; // treść fragmentu
  podobienstwo: number; // 0–1, im więcej, tym bliżej znaczeniem
};

// Wyszukiwanie w bazie wiedzy: pytanie -> embedding (ten sam model co przy imporcie)
// -> funkcja match_chunks w Supabase -> najbliższe znaczeniem fragmenty.
export async function searchKnowledge(question: string, count = 3): Promise<KnowledgeHit[]> {
  const { embedding } = await embed({ model: embeddingModel(), value: question });
  const { data, error } = await supabase().rpc("match_chunks", {
    query_embedding: toVector(embedding),
    match_count: count,
  });
  if (error) throw new Error(`Wyszukiwanie w bazie wiedzy nie powiodło się: ${error.message}`);
  return (data ?? []).map((row: { title: string; content: string; similarity: number }) => ({
    zrodlo: row.title,
    tresc: row.content,
    podobienstwo: Math.round(row.similarity * 100) / 100,
  }));
}
