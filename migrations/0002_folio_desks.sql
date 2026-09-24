create table if not exists folio_desks (
  user_id text primary key,
  books jsonb not null default '[]'::jsonb,
  active_book_id text,
  updated_at timestamptz not null default now()
);
