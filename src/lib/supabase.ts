import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Thiếu cấu hình Supabase. Vui lòng kiểm tra biến môi trường VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY trong Settings.');
}

export const supabase = createClient(
  supabaseUrl || 'http://localhost:54321', // Fallback for type safety during initial build before env is set
  supabaseAnonKey || 'public-anon-key'
);
