-- Lekcja 6: baza wiedzy (RAG). Najpierw Database -> Extensions -> włącz "vector".
-- Potem wklej ten skrypt w Supabase -> SQL Editor i kliknij Run.

create table documents (
  id bigint generated always as identity primary key,
  title text not null,
  created_at timestamptz not null default now()
);

create table chunks (
  id bigint generated always as identity primary key,
  document_id bigint not null references documents (id) on delete cascade,
  chunk_index int not null,
  content text not null,
  embedding extensions.vector(1536)
);

alter table documents enable row level security;
alter table chunks enable row level security;
grant all on table documents, chunks to service_role;

create or replace function match_chunks (
  query_embedding extensions.vector(1536),
  match_count int default 3
)
returns table (id bigint, document_id bigint, title text, content text, similarity float)
language sql stable
set search_path = public, extensions
as $$
  select c.id, c.document_id, d.title, c.content,
         1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  join documents d on d.id = c.document_id
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

grant execute on function match_chunks to service_role;
