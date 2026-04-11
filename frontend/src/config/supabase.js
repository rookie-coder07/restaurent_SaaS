import { createClient } from '@supabase/supabase-js';
import { reportClientError } from '../utils/errorHandling';

// Get Supabase credentials from environment variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://pzjjuuqwpbfbfosgblzv.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_h2HoLV5oiZpBIaMK4EQHiQ_UY6HjMZn';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  reportClientError(null, 'Missing Supabase environment variables');
}

// Create Supabase client for real-time subscriptions
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export default supabase;
