import { createClient } from '@supabase/supabase-js';

// Conexão com poderes de administrador. Só roda no servidor, nunca no navegador.
export function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}
