/**
 * ================================
 * Supabase Data Service
 * ================================
 * 
 * Service untuk CRUD data dengan Supabase
 * Fallback ke localStorage jika Supabase tidak dikonfigurasi
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User, AttendanceRecord, SystemSettings, UserRole } from '../types';
import * as localStorageService from './storageService';

// ================================
// Users
// ================================

export const getUsers = async (): Promise<User[]> => {
    if (!isSupabaseConfigured() || !supabase) {
        return localStorageService.getStoredUsers();
    }

    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) throw error;

        return data.map(profile => ({
            id: profile.id,
            username: profile.username,
            name: profile.name,
            role: profile.role as UserRole,
            division: profile.division,
        }));
    } catch {
        return localStorageService.getStoredUsers();
    }
};

export const saveUser = async (user: User): Promise<User[]> => {
    if (!isSupabaseConfigured() || !supabase) {
        return localStorageService.saveUser(user);
    }

    try {
        const { error } = await supabase
            .from('profiles')
            .upsert({
                id: user.id,
                username: user.username,
                name: user.name,
                role: user.role,
                division: user.division,
                updated_at: new Date().toISOString(),
            });

        if (error) throw error;
        return await getUsers();
    } catch {
        return localStorageService.saveUser(user);
    }
};

export const deleteUser = async (id: string): Promise<User[]> => {
    if (!isSupabaseConfigured() || !supabase) {
        return localStorageService.deleteUser(id);
    }

    try {
        const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return await getUsers();
    } catch {
        return localStorageService.deleteUser(id);
    }
};

// ================================
// Attendance
// ================================

export const getAttendance = async (): Promise<AttendanceRecord[]> => {
    if (!isSupabaseConfigured() || !supabase) {
        return localStorageService.getStoredAttendance();
    }

    try {
        const { data, error } = await supabase
            .from('attendance')
            .select(`
        *,
        profiles:user_id (name)
      `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        return data.map(record => ({
            id: record.id,
            userId: record.user_id,
            userName: record.profiles?.name || 'Unknown',
            date: record.date,
            checkInTime: record.check_in_time,
            checkOutTime: record.check_out_time,
            checkInPhoto: record.check_in_photo,
            attachment: record.attachment,
            location: record.location_lat && record.location_lng
                ? { lat: record.location_lat, lng: record.location_lng }
                : undefined,
            status: record.status,
            notes: record.notes,
        }));
    } catch {
        return localStorageService.getStoredAttendance();
    }
};

export const saveAttendance = async (record: AttendanceRecord): Promise<AttendanceRecord[]> => {
    if (!isSupabaseConfigured() || !supabase) {
        return localStorageService.saveAttendance(record);
    }

    try {
        const { error } = await supabase
            .from('attendance')
            .upsert({
                id: record.id,
                user_id: record.userId,
                date: record.date,
                check_in_time: record.checkInTime,
                check_out_time: record.checkOutTime,
                check_in_photo: record.checkInPhoto,
                attachment: record.attachment,
                location_lat: record.location?.lat,
                location_lng: record.location?.lng,
                status: record.status,
                notes: record.notes,
            });

        if (error) throw error;
        return await getAttendance();
    } catch {
        return localStorageService.saveAttendance(record);
    }
};

// ================================
// Settings
// ================================

export const getSettings = async (): Promise<SystemSettings> => {
    if (!isSupabaseConfigured() || !supabase) {
        return localStorageService.getSystemSettings();
    }

    try {
        const { data, error } = await supabase
            .from('settings')
            .select('*')
            .eq('id', 1)
            .single();

        if (error) throw error;

        return {
            appName: data.app_name,
            appSubtitle: data.app_subtitle,
            announcement: data.announcement,
            schedule: data.schedule as SystemSettings['schedule'],
            specialSchedules: data.special_schedules as SystemSettings['specialSchedules'],
            features: data.features as SystemSettings['features'],
        };
    } catch {
        return localStorageService.getSystemSettings();
    }
};

export const saveSettings = async (settings: SystemSettings): Promise<SystemSettings> => {
    if (!isSupabaseConfigured() || !supabase) {
        return localStorageService.saveSystemSettings(settings);
    }

    try {
        const { error } = await supabase
            .from('settings')
            .upsert({
                id: 1,
                app_name: settings.appName,
                app_subtitle: settings.appSubtitle,
                announcement: settings.announcement,
                schedule: settings.schedule,
                special_schedules: settings.specialSchedules,
                features: settings.features,
                updated_at: new Date().toISOString(),
            });

        if (error) throw error;
        return settings;
    } catch {
        return localStorageService.saveSystemSettings(settings);
    }
};

// ================================
// File Upload (Photos)
// ================================

export const uploadPhoto = async (
    base64Data: string,
    folder: string,
    fileName: string
): Promise<string> => {
    if (!isSupabaseConfigured() || !supabase) {
        // Return base64 as-is for demo mode
        return base64Data;
    }

    try {
        // Convert base64 to blob
        const base64Response = await fetch(base64Data);
        const blob = await base64Response.blob();

        const filePath = `${folder}/${fileName}`;

        const { error } = await supabase.storage
            .from('hadirkerja')
            .upload(filePath, blob, {
                contentType: 'image/jpeg',
                upsert: true,
            });

        if (error) throw error;

        // Get public URL
        const { data } = supabase.storage
            .from('hadirkerja')
            .getPublicUrl(filePath);

        return data.publicUrl;
    } catch {
        return base64Data;
    }
};
