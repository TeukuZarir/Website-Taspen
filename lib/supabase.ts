/**
 * ================================
 * Supabase Client Configuration
 * ================================
 * 
 * Supabase adalah Backend-as-a-Service yang menyediakan:
 * - PostgreSQL Database
 * - Authentication (Email, OAuth, dll)
 * - Storage untuk file uploads
 * - Realtime subscriptions
 * 
 * Setup:
 * 1. Buat project di https://supabase.com
 * 2. Copy URL dan anon key dari Project Settings > API
 * 3. Paste ke .env.local
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ================================
// Environment Variables
// ================================
// @ts-ignore - Vite env types
const supabaseUrl: string | undefined = import.meta.env?.VITE_SUPABASE_URL;
// @ts-ignore - Vite env types
const supabaseAnonKey: string | undefined = import.meta.env?.VITE_SUPABASE_ANON_KEY;

// ================================
// Validation
// ================================
if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
        '⚠️ Supabase environment variables not found. Running in demo mode with localStorage.'
    );
}

// ================================
// Supabase Client
// ================================
export const supabase: SupabaseClient | null =
    supabaseUrl && supabaseAnonKey
        ? createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true,
            },
        })
        : null;

// ================================
// Helper: Check if Supabase is configured
// ================================
export const isSupabaseConfigured = (): boolean => {
    return supabase !== null;
};

// ================================
// Database Types (for TypeScript)
// ================================
export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string;
                    username: string;
                    name: string;
                    role: 'ADMIN' | 'INTERN';
                    division: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
            };
            attendance: {
                Row: {
                    id: string;
                    user_id: string;
                    date: string;
                    check_in_time: string | null;
                    check_out_time: string | null;
                    check_in_photo: string | null;
                    attachment: string | null;
                    location_lat: number | null;
                    location_lng: number | null;
                    status: 'ON_TIME' | 'LATE' | 'PERMIT';
                    notes: string | null;
                    created_at: string;
                };
                Insert: Omit<Database['public']['Tables']['attendance']['Row'], 'id' | 'created_at'>;
                Update: Partial<Database['public']['Tables']['attendance']['Insert']>;
            };
            settings: {
                Row: {
                    id: number;
                    app_name: string;
                    app_subtitle: string | null;
                    announcement: string | null;
                    schedule: Record<string, unknown>;
                    special_schedules: Record<string, unknown>[];
                    features: Record<string, unknown>;
                    updated_at: string;
                };
                Insert: Omit<Database['public']['Tables']['settings']['Row'], 'id' | 'updated_at'>;
                Update: Partial<Database['public']['Tables']['settings']['Insert']>;
            };
        };
    };
}
