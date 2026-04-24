import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

let supabaseInstance: SupabaseClient | null = null;

function getSupabaseInstance(): SupabaseClient {
  if (!supabaseInstance) {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseInstance;
}

// Default export — lazy-loads on first access
export const supabase = {
  auth: {
    onAuthStateChange: (callback: any) => getSupabaseInstance().auth.onAuthStateChange(callback),
    signInWithPassword: (opts: any) => getSupabaseInstance().auth.signInWithPassword(opts),
    signInWithOtp: (opts: any) => getSupabaseInstance().auth.signInWithOtp(opts),
    verifyOtp: (opts: any) => getSupabaseInstance().auth.verifyOtp(opts),
    updateUser: (opts: any) => getSupabaseInstance().auth.updateUser(opts),
    getUser: () => getSupabaseInstance().auth.getUser(),
    getSession: () => getSupabaseInstance().auth.getSession(),
    signOut: () => getSupabaseInstance().auth.signOut(),
  },
  from: (table: string) => getSupabaseInstance().from(table),
} as SupabaseClient;
