// Supabase client — the single place a SupabaseClient is constructed.
//
// AURA is local-first: every existing feature (Clients/Projects/Rooms/BOQ/
// Quotation/Canvas/Media) already works entirely off Zustand + localStorage
// with no backend at all. Cloud sync is additive, and only turns on when
// both env vars below are actually set — see isSupabaseConfigured(). This
// keeps the app fully functional (and every existing test green) in any
// environment that hasn't been given real Supabase credentials, per this
// milestone's explicit "do not fake credentials" / backward-compatibility
// requirements.

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseKey)
}

// Deliberately not parameterized with a generated `Database` type — without
// real credentials in this environment there is no live project to run
// `supabase gen types` against. src/supabase/types.ts hand-declares the row
// shapes instead, and repositories/*.ts type their own inputs/outputs
// against those — see docs/SUPABASE_SETUP.md for regenerating real types
// once a project exists.
//
// Constructed unconditionally (createClient doesn't itself make a network
// call), but every call site must check isSupabaseConfigured() first — with
// placeholder values this client would only ever fail loudly against a
// non-existent host, never silently pretend to work.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.invalid',
  supabaseKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
