import { createClient } from '@supabase/supabase-js';

// Publishable keys are intended to ship in browser apps; RLS is the security boundary.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://paaxjmjuyjusmlnhfwnx.supabase.co';
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_hzSctJxgaKPksTpocpxjHA_gCFqQD8W';

export const isSupabaseConfigured = Boolean(url && publishableKey);
export const supabase = isSupabaseConfigured ? createClient(url, publishableKey) : null;

export const EMPTY_WORKSPACE = {
  staff: [],
  departments: [],
  categoryTypes: [],
  tasks: [],
};
