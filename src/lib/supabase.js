import { createClient } from '@supabase/supabase-js';

const envUrl = import.meta.env?.VITE_SUPABASE_URL || '';
const envAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

export const getSupabaseConfig = () => {
  const customUrl = localStorage.getItem('ltp_custom_supabase_url');
  const customKey = localStorage.getItem('ltp_custom_supabase_anon_key');

  const url = customUrl || envUrl || '';
  const anonKey = customKey || envAnonKey || '';

  return {
    url: url.trim(),
    anonKey: anonKey.trim(),
    isConfigured: Boolean(url && anonKey && url.startsWith('http') && !url.includes('placeholder'))
  };
};

export const saveSupabaseConfig = (url, anonKey) => {
  if (url && anonKey) {
    localStorage.setItem('ltp_custom_supabase_url', url.trim());
    localStorage.setItem('ltp_custom_supabase_anon_key', anonKey.trim());
    window.location.reload();
  }
};

export const clearCustomSupabaseConfig = () => {
  localStorage.removeItem('ltp_custom_supabase_url');
  localStorage.removeItem('ltp_custom_supabase_anon_key');
  window.location.reload();
};

const initialConfig = getSupabaseConfig();

const fallbackUrl = 'https://example-placeholder.supabase.co';
const fallbackKey = 'placeholder-anon-key-abc-123';

export const supabase = createClient(
  initialConfig.isConfigured ? initialConfig.url : fallbackUrl,
  initialConfig.isConfigured ? initialConfig.anonKey : fallbackKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  }
);
