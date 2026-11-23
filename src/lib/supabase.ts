import { createClient } from '@supabase/supabase-js'

const supabaseUrl = "https://hdtpxgmndniyqzgwfjwv.supabase.co";

if (!supabaseUrl) {
  throw new Error('VITE_SUPABASE_URL is not configured.')
}

const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string

if (!supabaseKey) {
  throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY is not configured. Enter it through Bolt\'s environment-variable interface.')
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

export const EDGE_FUNCTION_URL = `${supabaseUrl}/functions/v1/evaluation-access`
