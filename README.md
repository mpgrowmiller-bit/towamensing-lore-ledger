# Towamensing Burn Book

Shared neighborhood context app with local fallback and optional Supabase central storage.

## Central Book Setup

1. Create a Supabase project.
2. Open SQL Editor and run `supabase/lore-ledger.sql`.
3. Replace `CHANGE_THIS_PASSCODE` before running the final insert.
4. Copy the returned `book_id`.
5. Copy the project URL and publishable/anon key from Supabase API settings.
6. Open the app, use `Shared setup`, paste URL, key, and book ID, then enter the group passcode.
7. Use `Share` for a link that asks for the passcode, or `One-tap` for a link that includes it.

The browser never receives the Supabase service role key. Shared reads and writes go through RPC functions that verify the passcode server-side.
