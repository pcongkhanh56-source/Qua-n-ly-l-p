import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Thiếu cấu hình Supabase. Vui lòng thêm VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY vào Settings (biến môi trường).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
