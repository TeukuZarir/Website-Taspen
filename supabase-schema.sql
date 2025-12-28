-- ================================
-- HadirKerja Database Schema
-- ================================
-- 
-- CARA PENGGUNAAN:
-- 1. Login ke dashboard Supabase
-- 2. Pergi ke SQL Editor
-- 3. Copy-paste seluruh script ini
-- 4. Klik "Run"
-- ================================

-- ================================
-- 1. Enable Extensions
-- ================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================
-- 2. Profiles Table (extends auth.users)
-- ================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT CHECK (role IN ('ADMIN', 'INTERN')) DEFAULT 'INTERN',
  division TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

CREATE POLICY "Admins can delete profiles" ON public.profiles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- ================================
-- 3. Attendance Table
-- ================================
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  check_in_photo TEXT,
  attachment TEXT,
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  status TEXT CHECK (status IN ('ON_TIME', 'LATE', 'PERMIT')) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Enable Row Level Security
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Policies for attendance
CREATE POLICY "Users can view own attendance" ON public.attendance
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all attendance" ON public.attendance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

CREATE POLICY "Users can insert own attendance" ON public.attendance
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own attendance" ON public.attendance
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can update any attendance" ON public.attendance
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- ================================
-- 4. Settings Table (singleton)
-- ================================
CREATE TABLE IF NOT EXISTS public.settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  app_name TEXT DEFAULT 'HadirKerja',
  app_subtitle TEXT DEFAULT 'Sistem Absensi Magang Terintegrasi',
  announcement TEXT,
  schedule JSONB NOT NULL DEFAULT '{
    "name": "Jadwal Regular 2025",
    "checkInStart": "06:00",
    "checkInDeadline": "08:00",
    "checkOutStart": "17:00",
    "lateToleranceMinutes": 15,
    "startDate": "2025-01-01",
    "endDate": "2025-12-31",
    "defaultLocation": "-6.2088, 106.8456",
    "maxCheckInRadiusMeters": 200,
    "isActive": true,
    "allowWeekend": false
  }'::jsonb,
  special_schedules JSONB DEFAULT '[]'::jsonb,
  features JSONB NOT NULL DEFAULT '{
    "requireSelfie": true,
    "requireLocation": true,
    "allowAttendance": true
  }'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Policies for settings
CREATE POLICY "Anyone can view settings" ON public.settings
  FOR SELECT USING (true);

CREATE POLICY "Admins can update settings" ON public.settings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Insert default settings
INSERT INTO public.settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ================================
-- 5. Special Schedules Table
-- ================================
CREATE TABLE IF NOT EXISTS public.special_schedules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  check_in_start TIME NOT NULL,
  check_in_deadline TIME NOT NULL,
  check_out_start TIME NOT NULL,
  late_tolerance_minutes INTEGER DEFAULT 15,
  assigned_user_ids UUID[] DEFAULT '{}',
  override_location TEXT,
  override_radius INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.special_schedules ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view special schedules" ON public.special_schedules
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage special schedules" ON public.special_schedules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- ================================
-- 6. Storage Bucket for Photos
-- ================================
-- Run this in Supabase Dashboard > Storage
-- Create bucket named "hadirkerja" with public access

-- ================================
-- 7. Functions & Triggers
-- ================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to profiles
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Apply trigger to settings
CREATE TRIGGER settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ================================
-- 8. Create Initial Admin User
-- ================================
-- NOTE: Run this after creating auth user via Supabase Auth
-- Replace 'YOUR_ADMIN_USER_ID' with actual UUID from auth.users

-- INSERT INTO public.profiles (id, username, name, role)
-- VALUES ('YOUR_ADMIN_USER_ID', 'admin', 'Super Admin', 'ADMIN');

-- ================================
-- Done! Database ready for HadirKerja
-- ================================
