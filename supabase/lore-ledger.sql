create extension if not exists pgcrypto;

create table if not exists public.lore_books (
  id uuid primary key default gen_random_uuid(),
  label text not null default 'Towamensing Lore Ledger',
  passcode_hash text not null,
  entries jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.lore_books enable row level security;

revoke all on public.lore_books from anon, authenticated;

create or replace function public.lore_hash(passcode text)
returns text
language sql
stable
as $$
  select encode(digest(convert_to(passcode, 'UTF8'), 'sha256'), 'hex')
$$;

create or replace function public.lore_load(p_book_id uuid, p_passcode text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  book_entries jsonb;
begin
  select entries
    into book_entries
    from public.lore_books
   where id = p_book_id
     and passcode_hash = public.lore_hash(p_passcode);

  if book_entries is null then
    raise exception 'Invalid book link or passcode';
  end if;

  return book_entries;
end;
$$;

create or replace function public.lore_save(p_book_id uuid, p_passcode text, p_entries jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_entries jsonb;
begin
  update public.lore_books
     set entries = coalesce(p_entries, '[]'::jsonb),
         updated_at = now()
   where id = p_book_id
     and passcode_hash = public.lore_hash(p_passcode)
   returning entries into saved_entries;

  if saved_entries is null then
    raise exception 'Invalid book link or passcode';
  end if;

  return saved_entries;
end;
$$;

grant execute on function public.lore_load(uuid, text) to anon;
grant execute on function public.lore_save(uuid, text, jsonb) to anon;

-- Run this once after choosing the group passcode.
-- Replace CHANGE_THIS_PASSCODE before running.
insert into public.lore_books (label, passcode_hash, entries)
values (
  'Towamensing Lore Ledger',
  public.lore_hash('CHANGE_THIS_PASSCODE'),
  '[]'::jsonb
)
returning id as book_id;
