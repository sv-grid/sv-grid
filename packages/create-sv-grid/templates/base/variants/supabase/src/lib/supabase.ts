import { createClient, type SupabaseClient } from '@supabase/supabase-js'
// Dynamic, not static: the app builds and starts before .env exists.
import { env } from '$env/dynamic/public'

const set = (v: string | undefined) => (v && !v.includes('your-') ? v : '')

/** The project URL and anon key from .env, or '' while they are not filled in. */
export const supabaseUrl = set(env.PUBLIC_SUPABASE_URL)
export const supabaseKey = set(env.PUBLIC_SUPABASE_ANON_KEY)

/** The client, or null until .env has both the URL and the key. */
export const supabase: SupabaseClient | null = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null
