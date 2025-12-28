
export enum UserRole {
  ADMIN = 'ADMIN',
  INTERN = 'INTERN'
}

export interface User {
  id: string;
  username: string;
  name: string;
  password?: string; // stored plainly for demo simulation only
  role: UserRole;
  division?: string;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  date: string; // YYYY-MM-DD
  checkInTime: string; // ISO String
  checkOutTime?: string; // ISO String
  checkInPhoto?: string; // Base64 (Selfie)
  attachment?: string; // Base64 (Bukti Izin)
  location?: {
    lat: number;
    lng: number;
  };
  status: 'ON_TIME' | 'LATE' | 'PERMIT';
  notes?: string; // Alasan Izin
}

export interface SpecialSchedule {
  id: string;
  name: string; // Misal: "Piket Sabtu"
  date: string; // YYYY-MM-DD (Hanya satu hari)
  checkInStart: string;
  checkInDeadline: string;
  checkOutStart: string;
  lateToleranceMinutes: number;
  assignedUserIds: string[]; // Daftar ID user yang terkena jadwal ini
  // New Fields for Override
  overrideLocation?: string; // Format "lat, lng" (Opsional)
  overrideRadius?: number; // Meter (Opsional)
}

export interface SystemSettings {
  appName: string;
  appSubtitle: string;
  announcement?: string; // Pesan pengumuman dari admin
  schedule: {
    name: string;
    checkInStart: string; // HH:mm
    checkInDeadline: string; // HH:mm (Jam Masuk Resmi)
    checkOutStart: string; // HH:mm (Jam Pulang Resmi)
    lateToleranceMinutes: number;
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    defaultLocation: string; // Format: "lat, lng"
    maxCheckInRadiusMeters: number; // New: Radius validasi
    isActive: boolean;
    allowWeekend: boolean;
  };
  specialSchedules: SpecialSchedule[]; // Daftar jadwal khusus
  features: {
    requireSelfie: boolean;
    requireLocation: boolean; // New: Wajib GPS
    allowAttendance: boolean; // Master switch
  };
}

export interface AppState {
  currentUser: User | null;
  users: User[];
  attendance: AttendanceRecord[];
  settings: SystemSettings;
}
