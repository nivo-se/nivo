import { createClient } from '@supabase/supabase-js'

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
// Set VITE_AUTH_DISABLED=true for local dev when Supabase is unreachable (e.g. NXDOMAIN)
const authDisabled = import.meta.env.VITE_AUTH_DISABLED === 'true' || import.meta.env.VITE_AUTH_DISABLED === '1'

// Check if Supabase is configured
const isConfigured = !authDisabled && !!(supabaseUrl && supabaseAnonKey &&
  supabaseUrl.length > 0 &&
  !supabaseUrl.includes('placeholder') &&
  supabaseAnonKey.length > 0)

if (!isConfigured) {
  // console.warn('Supabase environment variables not configured. Some features may be limited.')
}

// Export configuration info
export const supabaseConfig = {
  url: supabaseUrl || null,
  anonKey: supabaseAnonKey || null,
  isConfigured
}

// Create Supabase client singleton (even if not configured, to prevent errors)
// Use a single instance to avoid multiple GoTrueClient warnings
let supabaseInstance: ReturnType<typeof createClient> | null = null

if (isConfigured) {
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: 'nivo-supabase-auth' // Use consistent storage key
    }
  })
}

export const supabase = supabaseInstance

// Database types (we'll expand these as we add more tables)
export interface Database {
  public: {
    Tables: {
      user_roles: {
        Row: {
          id: string
          user_id: string
          role: 'admin' | 'approved' | 'pending'
          approved_by: string | null
          approved_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          role?: 'admin' | 'approved' | 'pending'
          approved_by?: string | null
          approved_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          role?: 'admin' | 'approved' | 'pending'
          approved_by?: string | null
          approved_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      companies: {
        Row: {
          OrgNr: string
          name: string | null
          address: string | null
          city: string | null
          incorporation_date: string | null
          email: string | null
          homepage: string | null
          segment: string | null
          segment_name: string | null
          last_updated: string
        }
        Insert: {
          OrgNr: string
          name?: string | null
          address?: string | null
          city?: string | null
          incorporation_date?: string | null
          email?: string | null
          homepage?: string | null
          segment?: string | null
          segment_name?: string | null
          last_updated?: string
        }
        Update: {
          OrgNr?: string
          name?: string | null
          address?: string | null
          city?: string | null
          incorporation_date?: string | null
          email?: string | null
          homepage?: string | null
          segment?: string | null
          segment_name?: string | null
          last_updated?: string
        }
      }
      company_accounts_by_id: {
        Row: {
          companyId: string
          organisationNumber: string
          name: string
          year: number
          period: string
          periodStart: string
          periodEnd: string
          length: number
          currency: string
          remark: string | null
          referenceUrl: string | null
          accIncompleteCode: string | null
          accIncompleteDesc: string | null
          [key: string]: any // For all the financial fields
        }
        Insert: {
          companyId: string
          organisationNumber: string
          name: string
          year: number
          period: string
          periodStart: string
          periodEnd: string
          length: number
          currency: string
          remark?: string | null
          referenceUrl?: string | null
          accIncompleteCode?: string | null
          accIncompleteDesc?: string | null
          [key: string]: any
        }
        Update: {
          companyId?: string
          organisationNumber?: string
          name?: string
          year?: number
          period?: string
          periodStart?: string
          periodEnd?: string
          length?: number
          currency?: string
          remark?: string | null
          referenceUrl?: string | null
          accIncompleteCode?: string | null
          accIncompleteDesc?: string | null
          [key: string]: any
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Typed Supabase client - reuse the same instance to avoid multiple clients
export const typedSupabase = supabaseInstance as ReturnType<typeof createClient<Database>> | null
