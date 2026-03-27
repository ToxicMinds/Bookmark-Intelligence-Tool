// ─────────────────────────────────────────────────────────────────────────────
// Brain Vault — Auth & Cloud Sync Service (Supabase)
// ─────────────────────────────────────────────────────────────────────────────
//
// ⚠️  SETUP REQUIRED — fill in the two values below:
//   1. Go to https://supabase.com → New Project
//   2. Settings → API → copy "Project URL" and "anon public" key
//
// ⚠️  DATABASE SETUP — run this SQL in your Supabase SQL editor:
//
//   create table bookmarks (
//     id           uuid primary key default gen_random_uuid(),
//     user_id      uuid references auth.users not null,
//     payload      text not null,     -- AES-GCM encrypted JSON bookmark
//     updated_at   timestamptz default now()
//   );
//   alter table bookmarks enable row level security;
//   create policy "Users own their bookmarks" on bookmarks
//     for all using (auth.uid() = user_id);
//
// ─────────────────────────────────────────────────────────────────────────────

import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

// ── ⬇️  FILL THESE IN ────────────────────────────────────────────────────────
const SUPABASE_URL  = 'https://YOUR_PROJECT_ID.supabase.co';  // ← replace
const SUPABASE_ANON = 'YOUR_SUPABASE_ANON_KEY';               // ← replace
// ─────────────────────────────────────────────────────────────────────────────

const isConfigured = !SUPABASE_URL.includes('YOUR_PROJECT') && !SUPABASE_ANON.includes('YOUR_SUPABASE');

let supabase: SupabaseClient | null = null;
if (isConfigured) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON);
}

export type AuthUser = User;

class AuthService {
  private currentUser: User | null = null;

  /** Returns false if Supabase is not yet configured */
  get isReady(): boolean { return isConfigured && !!supabase; }

  async getUser(): Promise<User | null> {
    if (!this.isReady) return null;
    const { data } = await supabase!.auth.getUser();
    this.currentUser = data.user;
    return data.user;
  }

  async signUp(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
    if (!this.isReady) return { user: null, error: 'Supabase not configured — add your credentials to authService.ts' };
    const { data, error } = await supabase!.auth.signUp({ email, password });
    if (error) return { user: null, error: error.message };
    this.currentUser = data.user;
    return { user: data.user, error: null };
  }

  async signIn(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
    if (!this.isReady) return { user: null, error: 'Supabase not configured — add your credentials to authService.ts' };
    const { data, error } = await supabase!.auth.signInWithPassword({ email, password });
    if (error) return { user: null, error: error.message };
    this.currentUser = data.user;
    return { user: data.user, error: null };
  }

  async signOut(): Promise<void> {
    if (!this.isReady) return;
    await supabase!.auth.signOut();
    this.currentUser = null;
  }

  /**
   * Push a single encrypted bookmark payload to Supabase.
   * `payload` should be the AES-GCM encrypted string from EncryptionService.
   * Falls back silently if not configured/signed in.
   */
  async pushBookmark(localId: string, encryptedPayload: string): Promise<void> {
    if (!this.isReady || !this.currentUser) return;
    await supabase!.from('bookmarks').upsert({
      id: localId,
      user_id: this.currentUser.id,
      payload: encryptedPayload,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
  }

  /**
   * Pull all remote bookmarks for the signed-in user.
   * Returns array of encrypted payload strings — caller decrypts them.
   */
  async pullBookmarks(): Promise<{ id: string; payload: string }[]> {
    if (!this.isReady || !this.currentUser) return [];
    const { data, error } = await supabase!.from('bookmarks').select('id, payload');
    if (error || !data) return [];
    return data as { id: string; payload: string }[];
  }

  /**
   * Delete a bookmark from the remote store.
   */
  async deleteBookmark(localId: string): Promise<void> {
    if (!this.isReady || !this.currentUser) return;
    await supabase!.from('bookmarks').delete().eq('id', localId);
  }
}

export const authService = new AuthService();
