import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('=== SUPABASE CONFIG CHECK ===');
console.log('URL available:', Boolean(supabaseUrl));
console.log('KEY available:', Boolean(supabaseAnonKey));
console.log('URL:', supabaseUrl || 'MISSING');

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Thiếu cấu hình Supabase: VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY chưa được nạp vào bản build.'
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);