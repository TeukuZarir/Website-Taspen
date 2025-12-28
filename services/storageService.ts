
import { User, AttendanceRecord, UserRole, SystemSettings } from '../types';

const USERS_KEY = 'magang_users';
const ATTENDANCE_KEY = 'magang_attendance';
const SETTINGS_KEY = 'magang_settings';

// Seed initial data
const INITIAL_USERS: User[] = [
  { id: '1', username: 'admin', name: 'Super Admin', role: UserRole.ADMIN, password: 'password' },
  { id: '2', username: 'siswa', name: 'Budi Santoso', role: UserRole.INTERN, division: 'Frontend Dev', password: 'password' },
  { id: '3', username: 'ani', name: 'Ani Wijaya', role: UserRole.INTERN, division: 'UI/UX', password: 'password' },
];

const INITIAL_SETTINGS: SystemSettings = {
  appName: 'HadirKerja',
  appSubtitle: 'Sistem Absensi Magang Terintegrasi',
  announcement: '', // Default kosong
  schedule: {
    name: 'Jadwal Regular 2025',
    checkInStart: '06:00',
    checkInDeadline: '08:00',
    checkOutStart: '17:00',
    lateToleranceMinutes: 15,
    startDate: '2025-01-01',
    endDate: '2025-12-31',
    defaultLocation: '-6.2088, 106.8456', // Contoh: Monas Jakarta
    maxCheckInRadiusMeters: 200, // Default radius 200 meter
    isActive: true,
    allowWeekend: false
  },
  specialSchedules: [], // Init kosong
  features: {
    requireSelfie: true,
    requireLocation: true, // Default ON
    allowAttendance: true
  }
};

export const getStoredUsers = (): User[] => {
  const stored = localStorage.getItem(USERS_KEY);
  if (!stored) {
    localStorage.setItem(USERS_KEY, JSON.stringify(INITIAL_USERS));
    return INITIAL_USERS;
  }
  return JSON.parse(stored);
};

export const saveUser = (user: User) => {
  const users = getStoredUsers();
  const existingIndex = users.findIndex(u => u.id === user.id);
  if (existingIndex >= 0) {
    users[existingIndex] = user;
  } else {
    users.push(user);
  }
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  return users;
};

export const deleteUser = (id: string) => {
  const users = getStoredUsers().filter(u => u.id !== id);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  return users;
};

export const getStoredAttendance = (): AttendanceRecord[] => {
  const stored = localStorage.getItem(ATTENDANCE_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const saveAttendance = (record: AttendanceRecord) => {
  const records = getStoredAttendance();
  const existingIndex = records.findIndex(r => r.id === record.id);
  if (existingIndex >= 0) {
    records[existingIndex] = record;
  } else {
    records.push(record);
  }
  localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(records));
  return records;
};

export const getSystemSettings = (): SystemSettings => {
  const stored = localStorage.getItem(SETTINGS_KEY);
  if (!stored) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(INITIAL_SETTINGS));
    return INITIAL_SETTINGS;
  }
  
  // Migration logic for existing data that might miss new fields
  const settings = JSON.parse(stored);
  if (settings.schedule.maxCheckInRadiusMeters === undefined) {
      settings.schedule.maxCheckInRadiusMeters = 200;
  }
  if (settings.schedule.defaultLocation === undefined) {
      settings.schedule.defaultLocation = '-6.2088, 106.8456';
  }
  if (settings.features.requireLocation === undefined) {
      settings.features.requireLocation = true;
  }
  return settings;
};

export const saveSystemSettings = (settings: SystemSettings): SystemSettings => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  return settings;
};

// --- DATA BACKUP & RESTORE UTILS (NEW) ---
export const createBackupData = () => {
  const backup = {
    users: getStoredUsers(),
    attendance: getStoredAttendance(),
    settings: getSystemSettings(),
    timestamp: new Date().toISOString(),
    version: '1.0'
  };
  return JSON.stringify(backup, null, 2);
};

export const restoreDataFromBackup = (jsonString: string): boolean => {
  try {
    const data = JSON.parse(jsonString);
    if (data.users && Array.isArray(data.users)) {
      localStorage.setItem(USERS_KEY, JSON.stringify(data.users));
    }
    if (data.attendance && Array.isArray(data.attendance)) {
      localStorage.setItem(ATTENDANCE_KEY, JSON.stringify(data.attendance));
    }
    if (data.settings) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(data.settings));
    }
    return true;
  } catch (e) {
    console.error("Restore failed", e);
    return false;
  }
};

// Updated: Menggunakan logika Total Menit (Integer Comparison) yang lebih robust
// Ini menghindari masalah timezone atau anomali tanggal pada objek Date
export const calculateStatus = (checkInTime: string, deadline: string, toleranceMinutes: number): 'ON_TIME' | 'LATE' => {
  const checkInDate = new Date(checkInTime);
  
  // Ambil Jam dan Menit dari waktu check-in (Waktu Lokal Device User)
  const currentHours = checkInDate.getHours();
  const currentMinutes = checkInDate.getMinutes();
  
  // Konversi waktu check-in ke total menit sejak tengah malam
  // Contoh: 08:30 -> (8 * 60) + 30 = 510 menit
  const checkInTotalMinutes = (currentHours * 60) + currentMinutes;

  // Parsing deadline (format "HH:mm", misal "09:00")
  const [deadlineHour, deadlineMinute] = deadline.split(':').map(Number);
  
  // Konversi deadline ke total menit
  // Contoh: 09:00 -> 540 menit
  let deadlineTotalMinutes = (deadlineHour * 60) + deadlineMinute;
  
  // Tambahkan toleransi
  // Contoh: Toleransi 15 menit -> Deadline akhir = 555 menit (09:15)
  deadlineTotalMinutes += toleranceMinutes;

  // Bandingkan Integer
  // Jika CheckIn (510) > Deadline (555) -> False (ON_TIME)
  return checkInTotalMinutes > deadlineTotalMinutes ? 'LATE' : 'ON_TIME';
};

// --- Helper Baru: Get Local Date YYYY-MM-DD ---
// Menggantikan penggunaan .toISOString() yang menggunakan UTC
export const getLocalDateString = (dateObj: Date = new Date()): string => {
  // Teknik: Menggunakan sv-SE (Sweden) locale karena formatnya standar ISO YYYY-MM-DD
  // dan ini menghormati Timezone lokal browser.
  return dateObj.toLocaleDateString('sv-SE');
};

// --- Geolocation Utils (Haversine Formula) ---
export const getDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // Earth radius in meters
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

export const parseLocationString = (locString: string): {lat: number, lng: number} | null => {
  try {
    const [lat, lng] = locString.split(',').map(s => parseFloat(s.trim()));
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
    return null;
  } catch (e) {
    return null;
  }
};
