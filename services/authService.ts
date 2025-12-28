/**
 * ================================
 * Supabase Authentication Service
 * ================================
 * 
 * Service untuk menangani autentikasi dengan Supabase
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User, UserRole } from '../types';

// ================================
// Types
// ================================
export interface AuthResponse {
    success: boolean;
    user?: User;
    error?: string;
}

export interface SignUpData {
    email: string;
    password: string;
    username: string;
    name: string;
    role?: UserRole;
    division?: string;
}

// ================================
// Demo Mode (localStorage fallback)
// ================================
const DEMO_USERS: User[] = [
    { id: '1', username: 'admin', name: 'Super Admin', role: UserRole.ADMIN, password: 'password' },
    { id: '2', username: 'siswa', name: 'Budi Santoso', role: UserRole.INTERN, division: 'Frontend Dev', password: 'password' },
    { id: '3', username: 'ani', name: 'Ani Wijaya', role: UserRole.INTERN, division: 'UI/UX', password: 'password' },
];

// ================================
// Auth Functions
// ================================

/**
 * Login dengan username dan password
 */
export const signIn = async (username: string, password: string): Promise<AuthResponse> => {
    // Jika Supabase tidak dikonfigurasi, gunakan demo mode
    if (!isSupabaseConfigured() || !supabase) {
        const user = DEMO_USERS.find(u => u.username === username && u.password === password);
        if (user) {
            return { success: true, user };
        }
        return { success: false, error: 'Username atau password salah' };
    }

    try {
        // Supabase login dengan email (username@hadirkerja.local)
        const email = `${username}@hadirkerja.local`;
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            return { success: false, error: error.message };
        }

        if (!data.user) {
            return { success: false, error: 'User tidak ditemukan' };
        }

        // Fetch user profile
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

        if (profileError || !profile) {
            return { success: false, error: 'Profile tidak ditemukan' };
        }

        const user: User = {
            id: profile.id,
            username: profile.username,
            name: profile.name,
            role: profile.role as UserRole,
            division: profile.division,
        };

        return { success: true, user };
    } catch (err) {
        return { success: false, error: 'Terjadi kesalahan saat login' };
    }
};

/**
 * Sign up user baru (Admin only)
 */
export const signUp = async (data: SignUpData): Promise<AuthResponse> => {
    if (!isSupabaseConfigured() || !supabase) {
        return { success: false, error: 'Demo mode: Tidak bisa menambah user' };
    }

    try {
        const email = `${data.username}@hadirkerja.local`;

        // Create auth user
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password: data.password,
        });

        if (authError) {
            return { success: false, error: authError.message };
        }

        if (!authData.user) {
            return { success: false, error: 'Gagal membuat user' };
        }

        // Create profile
        const { error: profileError } = await supabase
            .from('profiles')
            .insert({
                id: authData.user.id,
                username: data.username,
                name: data.name,
                role: data.role || UserRole.INTERN,
                division: data.division,
            });

        if (profileError) {
            return { success: false, error: profileError.message };
        }

        const user: User = {
            id: authData.user.id,
            username: data.username,
            name: data.name,
            role: data.role || UserRole.INTERN,
            division: data.division,
        };

        return { success: true, user };
    } catch (err) {
        return { success: false, error: 'Terjadi kesalahan saat sign up' };
    }
};

/**
 * Logout
 */
export const signOut = async (): Promise<void> => {
    if (isSupabaseConfigured() && supabase) {
        await supabase.auth.signOut();
    }
};

/**
 * Get current session user
 */
export const getCurrentUser = async (): Promise<User | null> => {
    if (!isSupabaseConfigured() || !supabase) {
        return null;
    }

    try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return null;

        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (!profile) return null;

        return {
            id: profile.id,
            username: profile.username,
            name: profile.name,
            role: profile.role as UserRole,
            division: profile.division,
        };
    } catch {
        return null;
    }
};

/**
 * Reset password
 */
export const resetPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    if (!isSupabaseConfigured() || !supabase) {
        return { success: false, error: 'Demo mode: Reset password tidak tersedia' };
    }

    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) {
            return { success: false, error: error.message };
        }
        return { success: true };
    } catch {
        return { success: false, error: 'Terjadi kesalahan' };
    }
};
