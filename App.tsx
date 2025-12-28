
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { User, UserRole, AttendanceRecord, SystemSettings, SpecialSchedule } from './types';
import { getStoredUsers, getStoredAttendance, saveAttendance, saveUser, deleteUser, calculateStatus, getSystemSettings, saveSystemSettings, getLocalDateString } from './services/storageService';
import { Button } from './components/Button';
import { InternDashboard } from './components/InternDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { ForgotPassword } from './components/ForgotPassword';
import { Toast } from './components/Toast';

const AppContent: React.FC = () => {
  // Global State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Toast State
  const [toast, setToast] = useState<{
    isVisible: boolean;
    title: string;
    description: string;
    type: 'success' | 'error' | 'info';
  }>({ isVisible: false, title: '', description: '', type: 'info' });

  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') as 'light' | 'dark' || 'light';
    }
    return 'light';
  });

  // Login Form State
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  // Initial Load & Theme Effect
  useEffect(() => {
    setUsers(getStoredUsers());
    setAttendance(getStoredAttendance());
    setSettings(getSystemSettings());

    // Check for persisted session
    const savedUser = localStorage.getItem('current_user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Auth Protection Logic
  useEffect(() => {
    // If not logged in and not on login/forgot-password, redirect to login
    if (!currentUser && location.pathname !== '/login' && location.pathname !== '/forgot-password') {
      navigate('/login');
    }
    // If logged in and on login page, redirect to dashboard
    if (currentUser && (location.pathname === '/login' || location.pathname === '/forgot-password')) {
      navigate('/');
    }
  }, [currentUser, location.pathname, navigate]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // Helper for Notification
  const showToast = (title: string, description: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ isVisible: true, title, description, type });
  };

  const closeToast = () => {
    setToast(prev => ({ ...prev, isVisible: false }));
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const user = users.find(u => u.username === loginUsername && u.password === loginPassword);
    if (user) {
      setCurrentUser(user);
      localStorage.setItem('current_user', JSON.stringify(user));
      showToast('Selamat Datang', `Halo, ${user.name}!`, 'success');
      navigate('/');
    } else {
      setError('Kombinasi username dan password salah');
      showToast('Login Gagal', 'Periksa username dan password Anda.', 'error');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('current_user');
    setLoginUsername('');
    setLoginPassword('');
    showToast('Berhasil Keluar', 'Sampai jumpa lagi.', 'info');
    navigate('/login');
  };

  // ... (Keep existing handler functions: handleAddUser, handleDeleteUser, etc.)
  // We need to copy these from the original file or keep them if they were separate (they were inline)
  // To avoid huge replacement, I'll allow them to be re-defined here.

  // Admin Actions
  const handleAddUser = (user: User) => {
    const updatedUsers = saveUser(user);
    setUsers(updatedUsers);
    showToast('Berhasil', 'Pengguna baru berhasil ditambahkan.', 'success');
  };

  const handleDeleteUser = (id: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus pengguna ini?')) {
      const updatedUsers = deleteUser(id);
      setUsers(updatedUsers);
      showToast('Terhapus', 'Pengguna berhasil dihapus.', 'success');
    }
  };

  const handleResetPassword = (id: string, newPassword: string) => {
    const userToUpdate = users.find(u => u.id === id);
    if (userToUpdate) {
      const updatedUser = { ...userToUpdate, password: newPassword };
      const updatedUsers = saveUser(updatedUser);
      setUsers(updatedUsers);
      showToast('Berhasil', `Password untuk ${updatedUser.name} berhasil diubah.`, 'success');
    }
  };

  const handleUpdateSettings = (newSettings: SystemSettings) => {
    const saved = saveSystemSettings(newSettings);
    setSettings(saved);
  };

  const handleManualOverride = (record: AttendanceRecord) => {
    const updated = saveAttendance(record);
    setAttendance(updated);
    showToast('Diperbarui', 'Data absensi berhasil diubah manual.', 'success');
  };

  // Helper to determine active schedule
  const getActiveScheduleForUser = (user: User | null, currentSettings: SystemSettings | null) => {
    if (!user || !currentSettings) return null;

    const todayStr = getLocalDateString();

    // Check for special schedule
    const special = currentSettings.specialSchedules?.find(
      s => s.date === todayStr && s.assignedUserIds.includes(user.id)
    );

    if (special) {
      return {
        name: special.name,
        checkInStart: special.checkInStart,
        checkInDeadline: special.checkInDeadline,
        checkOutStart: special.checkOutStart,
        lateToleranceMinutes: special.lateToleranceMinutes,
        isSpecial: true,
        overrideLocation: special.overrideLocation,
        overrideRadius: special.overrideRadius
      };
    }

    return {
      name: currentSettings.schedule.name,
      checkInStart: currentSettings.schedule.checkInStart,
      checkInDeadline: currentSettings.schedule.checkInDeadline,
      checkOutStart: currentSettings.schedule.checkOutStart,
      lateToleranceMinutes: currentSettings.schedule.lateToleranceMinutes,
      isSpecial: false,
      overrideLocation: undefined,
      overrideRadius: undefined
    };
  };

  // Intern Actions
  const handleCheckIn = (photo: string, location: { lat: number, lng: number }) => {
    if (!currentUser || !settings) return;

    const activeSchedule = getActiveScheduleForUser(currentUser, settings);
    if (!activeSchedule) return;

    // 1. Check if Attendance is Allowed Globally
    if (!settings.features.allowAttendance || (!settings.schedule.isActive && !activeSchedule.isSpecial)) {
      showToast('Gagal Absen', "Sistem absensi sedang tidak aktif.", 'error');
      return;
    }

    const now = new Date();
    const todayStr = getLocalDateString(now);

    // 2. Date Range Validation (Only for regular schedule)
    if (!activeSchedule.isSpecial) {
      if (todayStr < settings.schedule.startDate || todayStr > settings.schedule.endDate) {
        showToast('Jadwal Tidak Valid', `Absensi hanya diizinkan antara ${settings.schedule.startDate} hingga ${settings.schedule.endDate}`, 'error');
        return;
      }
      const dayOfWeek = now.getDay(); // 0 = Minggu, 6 = Sabtu
      if (!settings.schedule.allowWeekend && (dayOfWeek === 0 || dayOfWeek === 6)) {
        showToast('Hari Libur', 'Absensi tidak diizinkan pada hari Sabtu dan Minggu.', 'error');
        return;
      }
    }

    // 3. Duplicate Check
    const existing = attendance.find(r => r.userId === currentUser.id && r.date === todayStr);
    const pendingSession = attendance.find(r => r.userId === currentUser.id && !r.checkOutTime && r.status !== 'PERMIT');

    if (existing || pendingSession) {
      if (pendingSession && pendingSession.date !== todayStr) {
        showToast('Sesi Menggantung', "Anda belum Checkout dari hari sebelumnya. Harap Check-out terlebih dahulu.", 'error');
      } else {
        showToast('Gagal', "Anda sudah melakukan check-in hari ini.", 'error');
      }
      return;
    }

    const status = calculateStatus(now.toISOString(), activeSchedule.checkInDeadline, activeSchedule.lateToleranceMinutes);
    const newRecord: AttendanceRecord = {
      id: Date.now().toString(),
      userId: currentUser.id,
      userName: currentUser.name,
      date: todayStr,
      checkInTime: now.toISOString(),
      status: status,
      checkInPhoto: photo,
      location: location
    };

    const updatedAttendance = saveAttendance(newRecord);
    setAttendance(updatedAttendance);

    if (status === 'LATE') {
      showToast('Berhasil Masuk (Terlambat)', 'Anda berhasil absen, namun tercatat terlambat.', 'info');
    } else {
      showToast('Berhasil Masuk', 'Selamat bekerja! Absensi berhasil dicatat.', 'success');
    }
  };

  const handlePermissionSubmit = (reason: string, proofBase64: string) => {
    if (!currentUser) return;

    const now = new Date();
    const todayStr = getLocalDateString(now);

    const existing = attendance.find(r => r.userId === currentUser.id && r.date === todayStr);
    if (existing) {
      showToast('Gagal', "Anda sudah memiliki catatan kehadiran/izin hari ini.", 'error');
      return;
    }

    const newRecord: AttendanceRecord = {
      id: Date.now().toString(),
      userId: currentUser.id,
      userName: currentUser.name,
      date: todayStr,
      checkInTime: now.toISOString(),
      checkOutTime: now.toISOString(),
      status: 'PERMIT',
      notes: reason,
      attachment: proofBase64,
      location: { lat: 0, lng: 0 }
    };

    const updatedAttendance = saveAttendance(newRecord);
    setAttendance(updatedAttendance);
    showToast('Izin Dikirim', 'Pengajuan izin/sakit berhasil disimpan.', 'success');
  };

  const handleCheckOut = () => {
    if (!currentUser) return;
    const now = new Date();
    const openRecords = attendance.filter(r => r.userId === currentUser.id && !r.checkOutTime && r.status !== 'PERMIT');
    const sessionToClose = openRecords.sort((a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime())[0];

    if (sessionToClose) {
      const updatedRecord = { ...sessionToClose, checkOutTime: now.toISOString() };
      const updatedAttendance = saveAttendance(updatedRecord);
      setAttendance(updatedAttendance);
      showToast('Berhasil Pulang', 'Terima kasih atas kerja keras Anda. Hati-hati di jalan.', 'success');
    } else {
      const todayStr = getLocalDateString(now);
      const todayPermit = attendance.find(r => r.userId === currentUser.id && r.date === todayStr && r.status === 'PERMIT');

      if (todayPermit) {
        showToast('Info', "Anda sedang status Izin hari ini, tidak perlu Check-out.", 'info');
      } else {
        const todayDone = attendance.find(r => r.userId === currentUser.id && r.date === todayStr && r.checkOutTime);
        if (todayDone) {
          showToast('Info', "Anda sudah Check-out sebelumnya hari ini.", 'info');
        } else {
          showToast('Gagal', "Anda harus Check-in terlebih dahulu sebelum Check-out!", 'error');
        }
      }
    }
  };

  // Data derivations
  const getInternData = () => {
    if (!currentUser) return { todayRecord: undefined, history: [] };
    const todayStr = getLocalDateString();
    let activeRecord = attendance.find(r => r.userId === currentUser.id && !r.checkOutTime && r.status !== 'PERMIT');
    if (!activeRecord) {
      activeRecord = attendance.find(r => r.userId === currentUser.id && r.date === todayStr);
    }
    const todayRecord = activeRecord;
    const history = attendance
      .filter(r => r.userId === currentUser.id)
      .sort((a, b) => new Date(b.checkInTime).getTime() - new Date(a.checkInTime).getTime());
    return { todayRecord, history };
  };

  if (!settings) return null; // Loading

  return (
    <div className="min-h-screen bg-[#f1f5f9] dark:bg-slate-950 font-sans selection:bg-indigo-100 selection:text-indigo-700 dark:selection:bg-indigo-900 dark:selection:text-indigo-100 transition-colors duration-300 text-slate-900 dark:text-slate-100">
      <Toast
        isVisible={toast.isVisible}
        title={toast.title}
        description={toast.description}
        type={toast.type}
        onClose={closeToast}
      />

      <Routes>
        <Route path="/login" element={
          <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4 relative overflow-hidden transition-colors duration-300 text-slate-900 dark:text-slate-100">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
              <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-blue-400/20 rounded-full blur-[100px] dark:bg-blue-600/10"></div>
              <div className="absolute bottom-[-10%] left-[-5%] w-[500px] h-[500px] bg-indigo-400/20 rounded-full blur-[100px] dark:bg-indigo-600/10"></div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 w-full max-w-5xl flex overflow-hidden min-h-[600px] z-10 transition-colors duration-300">
              {/* Left Side (Branding) */}
              <div className="hidden md:flex w-1/2 bg-white dark:bg-slate-900 p-12 flex-col justify-between relative border-r border-slate-100 dark:border-slate-700">
                <div className="relative z-10">
                  <div className="mb-8">
                    <div className="bg-white p-3 rounded-xl inline-block shadow-sm">
                      <img src="https://upload.wikimedia.org/wikipedia/id/a/ad/TASPEN.svg" alt="Logo Taspen" className="h-20 w-auto object-contain" />
                    </div>
                  </div>
                  <h2 className="text-4xl font-extrabold leading-tight text-slate-800 dark:text-white mb-4">
                    {settings.appName} <br />
                    <span className="text-indigo-600 dark:text-indigo-400">System</span>
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 text-lg leading-relaxed">{settings.appSubtitle}</p>
                </div>
                <div className="relative z-10 text-xs text-slate-400 dark:text-slate-500 space-y-1">
                  <p>© 2025 {settings.appName}.</p>
                  <p>Supported by TASPEN.</p>
                </div>
              </div>

              {/* Right Side (Form) */}
              <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center bg-slate-50/50 dark:bg-slate-800/50">
                <div className="max-w-sm mx-auto w-full">
                  <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Selamat Datang</h2>
                  <p className="text-slate-500 dark:text-slate-400 mb-8">Silakan masuk ke akun Anda.</p>

                  <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Username</label>
                      <input type="text" required className="w-full px-5 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all placeholder-slate-400 dark:placeholder-slate-500 text-slate-800 dark:text-white" value={loginUsername} onChange={e => setLoginUsername(e.target.value)} placeholder="Masukkan username Anda" />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Password</label>
                      </div>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          className="w-full px-5 py-3 pr-12 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all placeholder-slate-400 dark:placeholder-slate-500 text-slate-800 dark:text-white"
                          value={loginPassword}
                          onChange={e => setLoginPassword(e.target.value)}
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600"
                          title={showPassword ? "Sembunyikan Password" : "Lihat Password"}
                        >
                          {showPassword ? (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                    {error && (
                      <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm p-3 rounded-lg flex items-center gap-2 border border-red-100 dark:border-red-800">
                        {error}
                      </div>
                    )}
                    <Button type="submit" className="w-full py-3.5 text-base rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg">Masuk Sekarang</Button>
                  </form>
                  <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 text-center">
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Belum memiliki akun? <br />
                      <a href="#" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">Hubungi Admin</a>
                    </p>
                    <div className="mt-4">
                      <button onClick={() => navigate('/forgot-password')} className="text-sm text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 underline">Lupa Password?</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        } />

        <Route path="/forgot-password" element={
          <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg border border-slate-100 dark:border-slate-700">
              <ForgotPassword onBackToLogin={() => navigate('/login')} onShowToast={showToast} />
            </div>
          </div>
        } />

        <Route path="/" element={
          <>
            {/* Common Navigation Bar */}
            <nav className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 shadow-sm transition-all">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16">
                  <div className="flex items-center gap-3">
                    <div className="bg-white p-1.5 rounded-lg shadow-sm">
                      <img src="https://upload.wikimedia.org/wikipedia/id/a/ad/TASPEN.svg" alt="Logo Taspen" className="h-8 w-auto object-contain" />
                    </div>
                    <span className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">{settings.appName}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <button onClick={toggleTheme} className="p-2 rounded-lg text-slate-500 hover:bg-indigo-50 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-indigo-100 dark:hover:border-slate-700" title={theme === 'light' ? 'Ubah ke Mode Gelap' : 'Ubah ke Mode Terang'}>
                      {theme === 'light' ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                        </svg>
                      )}
                    </button>
                    <div className="text-right hidden sm:block">
                      <div className="text-sm font-bold text-slate-800 dark:text-white">{currentUser?.name}</div>
                      <div className="text-[10px] uppercase font-bold tracking-wider text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded inline-block">{currentUser?.role === UserRole.ADMIN ? 'Administrator' : 'Peserta Magang'}</div>
                    </div>
                    <Button variant="ghost" onClick={handleLogout} className="text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl px-4">Keluar</Button>
                  </div>
                </div>
              </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {currentUser?.role === UserRole.ADMIN ? (
                <AdminDashboard
                  users={users}
                  attendance={attendance}
                  settings={settings}
                  onAddUser={handleAddUser}
                  onDeleteUser={handleDeleteUser}
                  onResetPassword={handleResetPassword}
                  onUpdateSettings={handleUpdateSettings}
                  onOverrideAttendance={handleManualOverride}
                  onShowToast={showToast}
                />
              ) : (
                currentUser && (
                  <InternDashboard
                    user={currentUser}
                    settings={settings}
                    activeSchedule={getActiveScheduleForUser(currentUser, settings)}
                    {...getInternData()}
                    onCheckIn={handleCheckIn}
                    onCheckOut={handleCheckOut}
                    onLogout={handleLogout}
                    onShowToast={showToast}
                    onPermissionSubmit={handlePermissionSubmit}
                  />
                )
              )}
            </main>
          </>
        } />
      </Routes>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
};

export default App;
