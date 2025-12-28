
import React, { useState } from 'react';
import { User, AttendanceRecord, SystemSettings } from '../types';
import { Button } from './Button';
import { CameraModal } from './CameraModal';
import { getDistanceInMeters, parseLocationString } from '../services/storageService';

interface InternDashboardProps {
  user: User;
  settings: SystemSettings;
  activeSchedule: {
    name: string;
    checkInStart: string;
    checkInDeadline: string;
    checkOutStart: string;
    lateToleranceMinutes: number;
    isSpecial: boolean;
    overrideLocation?: string;
    overrideRadius?: number;
  } | null;
  todayRecord: AttendanceRecord | undefined;
  history: AttendanceRecord[];
  onCheckIn: (photo: string, location: { lat: number, lng: number }) => void;
  onCheckOut: () => void;
  onLogout: () => void;
  onShowToast: (title: string, description: string, type: 'success' | 'error' | 'info') => void;
  onPermissionSubmit: (reason: string, proofBase64: string) => void;
}

export const InternDashboard: React.FC<InternDashboardProps> = ({
  user, settings, activeSchedule, todayRecord, history, onCheckIn, onCheckOut, onLogout, onShowToast, onPermissionSubmit
}) => {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Permission Modal State
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [permissionReason, setPermissionReason] = useState('');
  const [permissionProof, setPermissionProof] = useState<string>('');
  const [fileName, setFileName] = useState('');

  const proceedToCameraOrSubmit = () => {
    if (settings.features.requireSelfie) {
      setIsCameraOpen(true);
    } else {
      // Bypass camera if not required
      handleCapture("");
    }
  };

  const handleStartCheckIn = () => {
    setIsLoading(true);

    // LOGIC FIX: Check settings FIRST before asking for browser permission
    if (!settings.features.requireLocation) {
      setIsLoading(false);
      proceedToCameraOrSubmit();
      return;
    }

    if (!navigator.geolocation) {
      onShowToast('Error', "Browser Anda tidak mendukung Geolokasi.", 'error');
      setIsLoading(false);
      return;
    }

    // Check permission flow (Only runs if requireLocation is TRUE)
    // OPTIMISASI: Mengizinkan maximumAge 5000 (5 detik cache) agar lebih cepat di HP
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLoading(false);

        // ---------------- GEOFENCING VALIDATION START ----------------
        // Logic ini hanya jalan jika requireLocation = true
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;

        // Determine Target Location (Priority: Override -> Global Default)
        const targetLocationStr = activeSchedule?.overrideLocation || settings.schedule.defaultLocation;
        const targetRadius = activeSchedule?.overrideRadius || settings.schedule.maxCheckInRadiusMeters;

        // Validasi hanya jika targetLocationStr tidak kosong
        if (targetLocationStr && targetLocationStr.trim() !== "") {
          const officeCoords = parseLocationString(targetLocationStr);

          if (officeCoords) {
            const distance = getDistanceInMeters(userLat, userLng, officeCoords.lat, officeCoords.lng);

            // Jika jarak melebihi radius, blokir absensi
            if (distance > targetRadius) {
              onShowToast('Lokasi Tidak Valid', `Anda berada ${Math.round(distance)}m dari lokasi absen yang ditentukan (Max: ${targetRadius}m). Silakan mendekat.`, 'error');
              return;
            }
          }
        }
        // ---------------- GEOFENCING VALIDATION END ------------------

        proceedToCameraOrSubmit();
      },
      (error) => {
        setIsLoading(false);
        onShowToast('Akses Ditolak', "Izin lokasi diperlukan untuk melakukan absensi (Wajib GPS Aktif).", 'error');
        console.error(error);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  };

  const handleCapture = (photo: string) => {
    setIsLoading(true);

    // LOGIC FIX: If location is not required, send dummy coordinates directly
    if (!settings.features.requireLocation) {
      onCheckIn(photo, { lat: 0, lng: 0 });
      setIsLoading(false);
      return;
    }

    // If location IS required, grab it again to save to record
    navigator.geolocation.getCurrentPosition(
      (position) => {
        onCheckIn(photo, {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setIsLoading(false);
      },
      () => {
        onShowToast('Gagal', "Gagal mendapatkan lokasi saat mengirim data.", 'error');
        setIsLoading(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // Limit size to 2MB to prevent LocalStorage issues
      if (file.size > 2 * 1024 * 1024) {
        onShowToast("File Terlalu Besar", "Maksimal ukuran file adalah 2MB.", "error");
        return;
      }

      setFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setPermissionProof(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const submitPermission = () => {
    if (!permissionReason.trim()) {
      onShowToast("Gagal", "Mohon isi alasan izin.", "error");
      return;
    }
    if (!permissionProof) {
      onShowToast("Gagal", "Mohon upload bukti (Foto/Surat Dokter).", "error");
      return;
    }

    onPermissionSubmit(permissionReason, permissionProof);
    setIsPermissionModalOpen(false);
    setPermissionReason('');
    setPermissionProof('');
    setFileName('');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <CameraModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCapture}
      />

      {/* Permission Modal */}
      {isPermissionModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-white/20 dark:border-slate-700 animate-slide-up">
            <h3 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Form Pengajuan Izin</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Alasan Izin / Sakit</label>
                <textarea
                  className="w-full border border-slate-200 dark:border-slate-600 rounded-xl p-3 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all resize-none"
                  rows={3}
                  placeholder="Contoh: Sakit demam, ada urusan keluarga..."
                  value={permissionReason}
                  onChange={(e) => setPermissionReason(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Upload Bukti (Foto/Surat)</label>
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-6 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                      {fileName ? fileName : "Klik untuk upload foto"}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Maks 2MB</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button variant="secondary" onClick={() => setIsPermissionModalOpen(false)}>Batal</Button>
              <Button onClick={submitPermission} className="bg-blue-600 hover:bg-blue-700">Izin Masuk</Button>
            </div>
          </div>
        </div>
      )}

      {/* Announcement Alert */}
      {settings.announcement && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
          <div>
            <h4 className="font-bold text-amber-800 dark:text-amber-400 text-sm">Pengumuman</h4>
            <p className="text-amber-700 dark:text-amber-300 text-sm mt-1 whitespace-pre-wrap">{settings.announcement}</p>
          </div>
        </div>
      )}

      {/* Special Schedule Alert */}
      {activeSchedule?.isSpecial && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-2xl p-4 flex items-center justify-between shadow-sm animate-pulse">
          <div className="flex items-center gap-3">
            <span className="bg-indigo-600 text-white p-2 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" /></svg>
            </span>
            <div>
              <h4 className="font-bold text-indigo-900 dark:text-indigo-200 text-sm">Jadwal Khusus Hari Ini</h4>
              <p className="text-indigo-700 dark:text-indigo-300 text-xs mt-0.5">Anda mengikuti: {activeSchedule.name}</p>
              {activeSchedule.overrideLocation && (
                <p className="text-amber-600 dark:text-amber-400 text-[10px] mt-0.5 font-bold">Lokasi khusus aktif</p>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-mono font-semibold text-indigo-900 dark:text-indigo-200">{activeSchedule.checkInDeadline} - {activeSchedule.checkOutStart}</p>
          </div>
        </div>
      )}

      <div className="relative rounded-3xl shadow-xl overflow-hidden">
        {/* Clean Blue Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-blue-700"></div>

        {/* Glassmorphism Overlay */}
        <div className="relative bg-white/5 backdrop-blur-sm p-8 flex flex-col md:flex-row justify-between items-center gap-6 text-white">
          {/* Subtle decorative element */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-400/10 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>

          <div className="flex items-center gap-5 z-10">
            {/* Avatar Circle */}
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center text-2xl font-bold shadow-lg">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Halo, {user.name}!</h2>
              <p className="text-white/70 text-sm mt-1 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="group flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-sm rounded-2xl text-white font-semibold transition-all duration-300 active:scale-95 hover:shadow-2xl z-10"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-80 group-hover:opacity-100 transition-opacity">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            Keluar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Attendance Card */}
        <div className="group bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-lg hover:shadow-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center text-center relative overflow-hidden transition-all duration-300">
          {/* Decorative element - blue only */}
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-100 dark:bg-blue-900/20 rounded-full blur-2xl"></div>
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-blue-50 dark:bg-blue-900/10 rounded-full blur-xl"></div>

          <div className="mb-6 relative z-10">
            {/* Time Display - Clean Blue */}
            <div className="relative">
              <div className="text-6xl font-black text-blue-600 dark:text-blue-400 tracking-tighter tabular-nums">
                {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })}
              </div>
            </div>
            <p className="text-slate-400 dark:text-slate-500 mt-3 font-semibold uppercase tracking-[0.2em] text-[10px]">Waktu Saat Ini</p>
            <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 rounded-full">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
              <p className="text-blue-600 dark:text-blue-400 text-xs font-semibold">
                {activeSchedule ? `${activeSchedule.checkInStart} - ${activeSchedule.checkInDeadline}` : 'Tidak ada jadwal'}
              </p>
            </div>
          </div>

          {!todayRecord ? (
            <div className="w-full max-w-sm relative z-10 space-y-4">
              {/* Main Check-in Button */}
              <button
                onClick={handleStartCheckIn}
                disabled={isLoading}
                className="w-full py-4 px-6 text-base font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-2xl transition-all duration-200 hover:shadow-lg hover:shadow-blue-200 dark:hover:shadow-blue-900/30 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {isLoading ? 'Memproses...' : 'Absen Masuk'}
              </button>

              {/* Secondary Button */}
              <button
                onClick={() => setIsPermissionModalOpen(true)}
                className="w-full py-4 px-6 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100/80 dark:bg-slate-700/50 hover:bg-slate-200/80 dark:hover:bg-slate-600/50 rounded-2xl transition-all duration-300 hover:scale-[1.01] border border-slate-200/50 dark:border-slate-600/50 flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Ajukan Izin / Sakit
              </button>

              <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
                {settings.features.requireSelfie || settings.features.requireLocation ? "📍 Memerlukan akses Kamera & Lokasi" : "✓ Siap Absen"}
              </p>
            </div>
          ) : !todayRecord.checkOutTime ? (
            <div className="space-y-6 w-full max-w-xs relative z-10">
              <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-800">
                <p className="text-xs font-bold uppercase text-emerald-600 dark:text-emerald-400 tracking-wider mb-1">
                  {todayRecord.status === 'PERMIT' ? 'Status Izin' : 'Berhasil Masuk'}
                </p>
                <p className="text-3xl font-bold tabular-nums">{new Date(todayRecord.checkInTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</p>
                <div className={`inline-flex items-center gap-1.5 mt-3 px-3 py-1 text-xs rounded-full font-bold ${todayRecord.status === 'LATE' ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' :
                  todayRecord.status === 'PERMIT' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' :
                    'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                  }`}>
                  <span className={`w-2 h-2 rounded-full ${todayRecord.status === 'LATE' ? 'bg-red-500' :
                    todayRecord.status === 'PERMIT' ? 'bg-blue-500' :
                      'bg-emerald-500'
                    }`}></span>
                  {todayRecord.status === 'LATE' ? 'TERLAMBAT' : todayRecord.status === 'PERMIT' ? 'IZIN DITERIMA' : 'TEPAT WAKTU'}
                </div>
              </div>

              {todayRecord.status !== 'PERMIT' && (
                <Button
                  onClick={onCheckOut}
                  variant="danger"
                  className="w-full py-4 rounded-2xl text-lg shadow-xl shadow-red-100 dark:shadow-none transition-transform hover:scale-105"
                >
                  ABSEN PULANG
                </Button>
              )}
            </div>
          ) : (
            <div className="w-full max-w-xs bg-slate-50 dark:bg-slate-700/50 p-8 rounded-3xl border border-slate-200 dark:border-slate-600 relative z-10">
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h3 className="text-slate-800 dark:text-white font-bold text-xl mb-2">Selesai Untuk Hari Ini!</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Sampai jumpa besok, istirahatlah yang cukup.</p>
              <div className="text-left space-y-3 text-sm bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                  <span className="text-slate-400">Masuk:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{new Date(todayRecord.checkInTime).toLocaleTimeString('id-ID')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Pulang:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {todayRecord.status === 'PERMIT' ? '-' : new Date(todayRecord.checkOutTime).toLocaleTimeString('id-ID')}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Recent History */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-lg border border-slate-200 dark:border-slate-700 flex flex-col h-full transition-all duration-300 relative overflow-hidden">
          {/* Decorative element - blue */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-100 dark:bg-blue-900/20 rounded-full blur-2xl -mr-10 -mt-10"></div>

          <div className="flex items-center gap-3 mb-6 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200/50 dark:shadow-blue-900/30">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Riwayat Terakhir</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">5 aktivitas terbaru</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto max-h-[350px] pr-2 scrollbar-thin relative z-10">
            {history.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <p>Belum ada riwayat absensi.</p>
              </div>
            ) : (
              <div className="relative border-l-2 border-slate-100 dark:border-slate-700 ml-3 space-y-6 py-2">
                {history.slice(0, 5).map(record => (
                  <div key={record.id} className="relative pl-6 group">
                    <span className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 shadow-sm ${record.status === 'LATE' ? 'bg-red-400' :
                      record.status === 'PERMIT' ? 'bg-blue-400' :
                        'bg-indigo-400'
                      }`}></span>
                    <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700 transition-colors group-hover:bg-white dark:group-hover:bg-slate-700 group-hover:shadow-md">
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-bold text-slate-800 dark:text-slate-200">{new Date(record.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wide ${record.status === 'LATE' ? 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-300' :
                          record.status === 'PERMIT' ? 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300' :
                            'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300'
                          }`}>
                          {record.status === 'LATE' ? 'Terlambat' : record.status === 'PERMIT' ? 'Izin' : 'Hadir'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 font-mono">
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                          {new Date(record.checkInTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className="h-px w-4 bg-slate-300 dark:bg-slate-600"></div>
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                          {record.checkOutTime ? new Date(record.checkOutTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '...'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
