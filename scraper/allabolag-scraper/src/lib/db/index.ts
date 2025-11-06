import { createClient } from '@supabase/supabase-js';
import * as schema from './schema';

// Create Supabase client
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_ANON_KEY!;
export const supabase = createClient(supabaseUrl, supabaseKey);

// For now, we'll use Supabase client directly instead of Drizzle
// This is a temporary solution until we can resolve the PostgreSQL connection issue
export const db = supabase;

export * from './schema';




