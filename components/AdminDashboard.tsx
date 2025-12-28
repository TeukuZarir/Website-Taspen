
import React, { useState, useEffect, useRef } from 'react';
import { User, AttendanceRecord, UserRole, SystemSettings, SpecialSchedule } from '../types';
import { Button } from './Button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import * as XLSX from 'xlsx';
import { getLocalDateString, createBackupData, restoreDataFromBackup } from '../services/storageService';

interface AdminDashboardProps {
  users: User[];
  attendance: AttendanceRecord[];
  settings: SystemSettings;
  onAddUser: (user: User) => void;
  onDeleteUser: (id: string) => void;
  onResetPassword: (id: string, newPassword: string) => void;
  onUpdateSettings: (settings: SystemSettings) => void;
  onOverrideAttendance: (record: AttendanceRecord) => void;
  onShowToast: (title: string, description: string, type: 'success' | 'error' | 'info') => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  users, attendance, settings, onAddUser, onDeleteUser, onResetPassword, onUpdateSettings, onOverrideAttendance, onShowToast
}) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'USERS' | 'HISTORY' | 'SETTINGS'>('OVERVIEW');

  // Create User Form State
  const [newUser, setNewUser] = useState({ name: '', username: '', password: '', role: UserRole.INTERN, division: '' });

  // Settings Form State
  const [tempSettings, setTempSettings] = useState<SystemSettings>(settings);

  // Special Schedule Form State
  const [newSpecial, setNewSpecial] = useState<Partial<SpecialSchedule>>({
    name: '',
    date: getLocalDateString(),
    checkInStart: '07:00',
    checkInDeadline: '09:00',
    checkOutStart: '15:00',
    lateToleranceMinutes: 15,
    assignedUserIds: [],
    overrideLocation: '',
    overrideRadius: undefined
  });

  // Editing Record State
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);

  // Restore File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTempSettings(settings);
  }, [settings]);

  // Stats Logic
  const today = getLocalDateString();
  const presentToday = attendance.filter(r => r.date === today && r.status !== 'PERMIT').length;
  const lateToday = attendance.filter(r => r.date === today && r.status === 'LATE').length;
  const permitToday = attendance.filter(r => r.date === today && r.status === 'PERMIT').length;

  // Chart Data Preparation
  const getLast7Days = () => {
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = getLocalDateString(d);
      const count = attendance.filter(r => r.date === dateStr).length;
      result.push({ name: d.toLocaleDateString('id-ID', { weekday: 'short' }), count });
    }
    return result;
  };
  const chartData = getLast7Days();

  const handleExportExcel = () => {
    const now = new Date();
    const formattedDate = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const formattedTime = now.toLocaleTimeString('id-ID');
    const reportTitle = [
      [`LAPORAN PRESENSI ${settings.appName.toUpperCase()}`],
      [`Dicetak pada: ${formattedDate} Pukul ${formattedTime}`],
      [`Oleh Administrator`],
      [""]
    ];
    const tableHeader = [
      "No", "Nama Peserta", "Divisi", "Tanggal", "Waktu Masuk", "Waktu Keluar", "Status Kehadiran", "Lokasi (Lat, Lng)", "Catatan / Izin"
    ];
    const tableBody = attendance.map((r, index) => {
      const userDetail = users.find(u => u.id === r.userId);
      const division = userDetail?.division || '-';
      return [
        index + 1,
        r.userName,
        division,
        r.date,
        new Date(r.checkInTime).toLocaleTimeString('id-ID'),
        r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString('id-ID') : '-',
        r.status === 'LATE' ? 'TERLAMBAT' : r.status === 'PERMIT' ? 'IZIN/SAKIT' : 'TEPAT WAKTU',
        r.location ? `${r.location.lat}, ${r.location.lng}` : '-',
        r.notes || '-'
      ];
    });
    const finalData = [...reportTitle, tableHeader, ...tableBody];
    const worksheet = XLSX.utils.aoa_to_sheet(finalData);
    const wscols = [
      { wch: 5 }, { wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 30 }, { wch: 30 },
    ];
    worksheet['!cols'] = wscols;
    worksheet['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 8 } },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Absensi");
    const fileName = `Laporan_Absensi_${today}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    onShowToast("Unduhan Berhasil", `Laporan profesional berhasil diunduh.`, "success");
  };

  // --- BACKUP & RESTORE HANDLERS ---
  const handleBackupData = () => {
    const jsonString = createBackupData();
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `HadirKerja_Backup_${getLocalDateString()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast("Backup Berhasil", "Arsip data berhasil diunduh.", "success");
  };

  const handleRestoreClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        if (window.confirm("PERINGATAN: Restore akan menimpa data yang ada saat ini dengan data dari file backup. Lanjutkan?")) {
          const success = restoreDataFromBackup(content);
          if (success) {
            onShowToast("Restore Berhasil", "Silakan refresh halaman untuk melihat data yang dipulihkan.", "success");
            setTimeout(() => window.location.reload(), 1500);
          } else {
            onShowToast("Restore Gagal", "File backup tidak valid atau rusak.", "error");
          }
        }
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };
  // ---------------------------------

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    onAddUser({
      id: Date.now().toString(),
      ...newUser
    } as User);
    setNewUser({ name: '', username: '', password: '', role: UserRole.INTERN, division: '' });
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(tempSettings);
    onShowToast("Berhasil", "Perubahan Berhasil di lakukan", "success");
  };

  const handleAddSpecialSchedule = () => {
    if (!newSpecial.name || !newSpecial.assignedUserIds || newSpecial.assignedUserIds.length === 0) {
      onShowToast("Gagal", "Mohon lengkapi nama jadwal dan pilih minimal satu peserta.", "error");
      return;
    }
    const scheduleToAdd: SpecialSchedule = {
      id: Date.now().toString(),
      name: newSpecial.name!,
      date: newSpecial.date!,
      checkInStart: newSpecial.checkInStart || '07:00',
      checkInDeadline: newSpecial.checkInDeadline || '08:00',
      checkOutStart: newSpecial.checkOutStart || '16:00',
      lateToleranceMinutes: newSpecial.lateToleranceMinutes || 15,
      assignedUserIds: newSpecial.assignedUserIds!,
      overrideLocation: newSpecial.overrideLocation,
      overrideRadius: newSpecial.overrideRadius
    };
    const updatedSpecialSchedules = [...(tempSettings.specialSchedules || []), scheduleToAdd];
    setTempSettings({ ...tempSettings, specialSchedules: updatedSpecialSchedules });
    setNewSpecial({
      name: '',
      date: getLocalDateString(),
      checkInStart: '07:00',
      checkInDeadline: '09:00',
      checkOutStart: '15:00',
      lateToleranceMinutes: 15,
      assignedUserIds: [],
      overrideLocation: '',
      overrideRadius: undefined
    });
    onShowToast("Jadwal Ditambahkan", "Jadwal khusus berhasil disimpan sementara. Klik Simpan Global untuk menerapkan.", "info");
  };

  const handleDeleteSpecialSchedule = (id: string) => {
    const updated = tempSettings.specialSchedules?.filter(s => s.id !== id) || [];
    setTempSettings({ ...tempSettings, specialSchedules: updated });
  };

  const toggleUserSelection = (userId: string) => {
    const current = newSpecial.assignedUserIds || [];
    if (current.includes(userId)) {
      setNewSpecial({ ...newSpecial, assignedUserIds: current.filter(id => id !== userId) });
    } else {
      setNewSpecial({ ...newSpecial, assignedUserIds: [...current, userId] });
    }
  };

  const handleSaveOverride = () => {
    if (editingRecord) {
      onOverrideAttendance(editingRecord);
      setEditingRecord(null);
    }
  };

  const handleUserResetPassword = (user: User) => {
    const newPassword = window.prompt(`Masukkan password baru untuk ${user.name}:`);
    if (newPassword && newPassword.trim() !== '') {
      onResetPassword(user.id, newPassword);
    }
  };

  const formatIsoToLocalInput = (isoString: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      const offsetMs = d.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(d.getTime() - offsetMs)).toISOString().slice(0, 16);
      return localISOTime;
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="space-y-8 animate-fade-in text-slate-900 dark:text-slate-100">
      {/* Header & Navigation */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/70 dark:bg-slate-800/70 backdrop-blur-md p-6 rounded-3xl shadow-sm border border-white/50 dark:border-slate-700 transition-colors">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">Dasbor Admin</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Pantau kinerja peserta magang dan kelola pengguna.</p>
        </div>
        <div className="flex bg-slate-100/50 dark:bg-slate-700/50 p-1.5 rounded-2xl overflow-x-auto max-w-full">
          {[
            { id: 'OVERVIEW', label: 'Ringkasan' },
            { id: 'HISTORY', label: 'Riwayat' },
            { id: 'USERS', label: 'Pengguna' },
            { id: 'SETTINGS', label: 'Pengaturan' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 whitespace-nowrap ${activeTab === tab.id
                ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-md'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'OVERVIEW' && (
        <div className="animate-fade-in space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-3xl shadow-lg shadow-blue-200 dark:shadow-none text-white relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 20 20"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"></path></svg>
              </div>
              <p className="text-blue-100 font-medium">Total Peserta</p>
              <h3 className="text-4xl font-bold mt-2">{users.filter(u => u.role === UserRole.INTERN).length}</h3>
              <p className="text-xs text-blue-200 mt-4 bg-white/20 inline-block px-2 py-1 rounded-lg">Terdaftar Aktif</p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 group hover:border-emerald-200 dark:hover:border-emerald-700 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 dark:text-slate-400 font-medium">Hadir Hari Ini</p>
                  <h3 className="text-4xl font-bold text-slate-800 dark:text-white mt-2">{presentToday}</h3>
                </div>
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 group hover:border-blue-200 dark:hover:border-blue-700 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 dark:text-slate-400 font-medium">Izin / Sakit</p>
                  <h3 className="text-4xl font-bold text-slate-800 dark:text-white mt-2">{permitToday}</h3>
                </div>
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">Tren Kehadiran (7 Hari)</h3>
                <span className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-slate-500">Jadwal: {settings.schedule.checkInStart} - {settings.schedule.checkInDeadline}</span>
              </div>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:stroke-slate-700" />
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: 'var(--tooltip-bg, #fff)', color: 'var(--tooltip-text, #000)' }}
                      itemStyle={{ color: '#6366f1' }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill="#6366f1" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'HISTORY' && (
        <div className="animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
              <h3 className="font-bold text-slate-700 dark:text-slate-200 text-lg">Semua Data Absensi</h3>
              <Button variant="secondary" onClick={handleExportExcel} className="text-sm bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 dark:text-emerald-400"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                Unduh Excel
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700">
                  <tr>
                    <th className="p-5 font-semibold">Peserta</th>
                    <th className="p-5 font-semibold">Tanggal</th>
                    <th className="p-5 font-semibold">Masuk</th>
                    <th className="p-5 font-semibold">Keluar</th>
                    <th className="p-5 font-semibold">Status</th>
                    <th className="p-5 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                  {attendance.length === 0 ? (
                    <tr><td colSpan={6} className="p-10 text-center text-slate-400 dark:text-slate-500">Belum ada data absensi.</td></tr>
                  ) : (
                    attendance.slice().reverse().map((record) => (
                      <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="p-5 font-medium text-slate-900 dark:text-slate-100 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-xs text-slate-600 dark:text-slate-300 font-bold">
                            {record.userName.charAt(0)}
                          </div>
                          {record.userName}
                        </td>
                        <td className="p-5 text-slate-500 dark:text-slate-400">{record.date}</td>
                        <td className="p-5 text-slate-900 dark:text-slate-100 font-mono text-xs">{new Date(record.checkInTime).toLocaleTimeString('id-ID')}</td>
                        <td className="p-5 text-slate-500 dark:text-slate-400 font-mono text-xs">
                          {record.checkOutTime ? new Date(record.checkOutTime).toLocaleTimeString('id-ID') : (record.status === 'PERMIT' ? '-' : <span className="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded-md font-medium text-[10px] uppercase tracking-wider animate-pulse">Aktif</span>)}
                        </td>
                        <td className="p-5">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${record.status === 'LATE'
                            ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-800'
                            : record.status === 'PERMIT'
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800'
                              : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800'
                            }`}>
                            {record.status === 'LATE' ? 'TERLAMBAT' : record.status === 'PERMIT' ? 'IZIN' : 'TEPAT WAKTU'}
                          </span>
                        </td>
                        <td className="p-5 text-right">
                          <Button
                            variant="ghost"
                            onClick={() => setEditingRecord(record)}
                            className="text-indigo-500 hover:bg-indigo-50 px-2 py-1 text-xs"
                          >
                            Edit
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {editingRecord && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold mb-4 text-slate-900 dark:text-white">Override Data Absensi</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Status Kehadiran</label>
                <select
                  className="w-full border p-2 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white dark:border-slate-600"
                  value={editingRecord.status}
                  onChange={(e) => setEditingRecord({ ...editingRecord, status: e.target.value as any })}
                >
                  <option value="ON_TIME">Tepat Waktu</option>
                  <option value="LATE">Terlambat</option>
                  <option value="PERMIT">Izin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Waktu Masuk</label>
                <input
                  type="datetime-local"
                  className="w-full border p-2 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white dark:border-slate-600"
                  value={formatIsoToLocalInput(editingRecord.checkInTime)}
                  onChange={(e) => {
                    const date = new Date(e.target.value);
                    if (!isNaN(date.getTime())) {
                      setEditingRecord({ ...editingRecord, checkInTime: date.toISOString() });
                    }
                  }}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" onClick={() => setEditingRecord(null)}>Batal</Button>
              <Button onClick={handleSaveOverride}>Simpan</Button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'USERS' && (
        <div className="animate-fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 h-fit">
              <h3 className="text-lg font-bold mb-4 text-slate-800 dark:text-white">Tambah Peserta</h3>
              <form onSubmit={handleAddUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Nama Lengkap</label>
                  <input required type="text" placeholder="Contoh: Budi Santoso" className="w-full border border-slate-200 dark:border-slate-600 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white transition-all" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Username</label>
                  <input required type="text" placeholder="Contoh: budi.santoso" className="w-full border border-slate-200 dark:border-slate-600 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white transition-all" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Password</label>
                  <input required type="password" placeholder="••••••••" className="w-full border border-slate-200 dark:border-slate-600 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white transition-all" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Peran (Role)</label>
                  <select
                    className="w-full border border-slate-200 dark:border-slate-600 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white transition-all"
                    value={newUser.role}
                    onChange={e => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                  >
                    <option value={UserRole.INTERN}>Peserta Magang</option>
                    <option value={UserRole.ADMIN}>Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Divisi / Kelas</label>
                  <input required type="text" placeholder="Contoh: Frontend Dev" className="w-full border border-slate-200 dark:border-slate-600 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white transition-all" value={newUser.division} onChange={e => setNewUser({ ...newUser, division: e.target.value })} />
                </div>
                <Button type="submit" className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 py-3 rounded-xl">Buat Akun</Button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-700">
                <h3 className="font-bold text-slate-700 dark:text-slate-200 text-lg">Manajemen Pengguna</h3>
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700">
                  <tr>
                    <th className="p-5">Nama</th>
                    <th className="p-5">Role</th>
                    <th className="p-5">Divisi</th>
                    <th className="p-5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                  {users.map(user => (
                    <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 group">
                      <td className="p-5 font-medium">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-100 to-purple-50 dark:from-indigo-900 dark:to-purple-900 flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-bold text-sm shadow-sm border border-white dark:border-slate-600">
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <div className="text-slate-900 dark:text-white font-semibold">{user.name}</div>
                            <div className="text-slate-400 text-xs">@{user.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-5">
                        <span className={`px-2.5 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider ${user.role === UserRole.ADMIN
                          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                          }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="p-5 text-slate-600 dark:text-slate-400">{user.division || '-'}</td>
                      <td className="p-5 text-right">
                        {user.role !== UserRole.ADMIN && (
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => handleUserResetPassword(user)}
                              className="text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 p-2 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-all"
                              title="Reset Password"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" /></svg>
                            </button>
                            <button
                              onClick={() => onDeleteUser(user.id)}
                              className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                              title="Hapus Pengguna"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'SETTINGS' && (
        <div className="animate-fade-in">
          <div className="grid grid-cols-1 gap-8">
            <form onSubmit={handleSaveSettings} className="grid grid-cols-1 md:grid-cols-2 gap-8">

              {/* DATA MANAGEMENT (NEW) */}
              <div className="md:col-span-2 bg-gradient-to-r from-slate-100 to-white dark:from-slate-800 dark:to-slate-900 p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 dark:border-slate-700 pb-4 mb-4 w-full">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                      </svg>
                      Manajemen Data & Backup
                    </h3>
                    <p className="text-slate-500 text-sm mt-1">Unduh arsip data JSON untuk cadangan manual.</p>
                  </div>
                  <div className="flex gap-3">
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept=".json"
                      onChange={handleFileRestore}
                    />
                    <Button type="button" variant="secondary" onClick={handleRestoreClick} className="border-indigo-200 dark:border-slate-600 text-indigo-700 dark:text-indigo-300">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                      Restore Data
                    </Button>
                    <Button type="button" onClick={handleBackupData} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      Download Backup
                    </Button>
                  </div>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-xl flex gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-600 dark:text-yellow-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    <strong>Info Database:</strong> Data sistem tersimpan aman secara terpusat. Fitur Backup & Restore ini disediakan sebagai <strong>langkah antisipasi (Jaga-jaga)</strong> atau untuk keperluan arsip data manual.
                  </p>
                </div>
              </div>

              {/* System Announcement */}
              <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                <h3 className="text-lg font-bold mb-6 text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-3">Pengumuman & Informasi</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Pesan untuk Peserta</label>
                    <textarea
                      rows={4}
                      className="w-full border border-slate-200 dark:border-slate-600 rounded-xl p-3 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all resize-none"
                      placeholder="Tulis pengumuman di sini..."
                      value={tempSettings.announcement || ''}
                      onChange={e => setTempSettings({ ...tempSettings, announcement: e.target.value })}
                    />
                    <p className="text-xs text-slate-500 mt-2">Pesan ini akan tampil di bagian atas dashboard semua peserta magang.</p>
                  </div>
                </div>
              </div>

              {/* Feature Toggles */}
              <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                <h3 className="text-lg font-bold mb-6 text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-3">Kontrol Fitur</h3>
                <div className="space-y-4">
                  <label className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors group">
                    <span className="text-slate-700 dark:text-slate-300 font-medium group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Aktifkan Sistem Absensi</span>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={tempSettings.features.allowAttendance} onChange={e => setTempSettings({ ...tempSettings, features: { ...tempSettings.features, allowAttendance: e.target.checked } })} />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600 shadow-sm"></div>
                    </div>
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors group">
                    <span className="text-slate-700 dark:text-slate-300 font-medium group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Wajib Foto Selfie</span>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={tempSettings.features.requireSelfie} onChange={e => setTempSettings({ ...tempSettings, features: { ...tempSettings.features, requireSelfie: e.target.checked } })} />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600 shadow-sm"></div>
                    </div>
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors group">
                    <span className="text-slate-700 dark:text-slate-300 font-medium group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Wajib Lokasi GPS</span>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={tempSettings.features.requireLocation} onChange={e => setTempSettings({ ...tempSettings, features: { ...tempSettings.features, requireLocation: e.target.checked } })} />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600 shadow-sm"></div>
                    </div>
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors group">
                    <span className="text-slate-700 dark:text-slate-300 font-medium group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">Jadwal Aktif (Global)</span>
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={tempSettings.schedule.isActive} onChange={e => setTempSettings({ ...tempSettings, schedule: { ...tempSettings.schedule, isActive: e.target.checked } })} />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600 shadow-sm"></div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Global Schedule Settings */}
              <div className="md:col-span-2 bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
                {/* ... (Existing Form Code) */}
                <h3 className="text-lg font-bold mb-6 text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-3">Konfigurasi Jadwal & Lokasi Kantor</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Nama Jadwal</label>
                    <input type="text" className="w-full border border-slate-200 dark:border-slate-600 rounded-xl p-3 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" value={tempSettings.schedule.name} onChange={e => setTempSettings({ ...tempSettings, schedule: { ...tempSettings.schedule, name: e.target.value } })} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Lokasi Kantor (Lat, Lng)</label>
                    <input type="text" className="w-full border border-slate-200 dark:border-slate-600 rounded-xl p-3 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white font-mono text-sm" value={tempSettings.schedule.defaultLocation} onChange={e => setTempSettings({ ...tempSettings, schedule: { ...tempSettings.schedule, defaultLocation: e.target.value } })} />
                    <p className="text-xs text-slate-500 mt-1">Salin dari Google Maps (Contoh: -6.2088, 106.8456)</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Radius Maksimum (Meter)</label>
                    <input type="number" className="w-full border border-slate-200 dark:border-slate-600 rounded-xl p-3 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white font-bold text-indigo-600 dark:text-indigo-400" value={tempSettings.schedule.maxCheckInRadiusMeters} onChange={e => setTempSettings({ ...tempSettings, schedule: { ...tempSettings.schedule, maxCheckInRadiusMeters: parseInt(e.target.value) } })} />
                    <p className="text-xs text-slate-500 mt-1">Saran: 50-200 meter.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Jam Buka Absen</label>
                    <input type="time" className="w-full border border-slate-200 dark:border-slate-600 rounded-xl p-3 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" value={tempSettings.schedule.checkInStart} onChange={e => setTempSettings({ ...tempSettings, schedule: { ...tempSettings.schedule, checkInStart: e.target.value } })} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Jam Masuk (Deadline)</label>
                    <input type="time" className="w-full border border-slate-200 dark:border-slate-600 rounded-xl p-3 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" value={tempSettings.schedule.checkInDeadline} onChange={e => setTempSettings({ ...tempSettings, schedule: { ...tempSettings.schedule, checkInDeadline: e.target.value } })} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Toleransi (Menit)</label>
                    <input type="number" className="w-full border border-slate-200 dark:border-slate-600 rounded-xl p-3 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" value={tempSettings.schedule.lateToleranceMinutes} onChange={e => setTempSettings({ ...tempSettings, schedule: { ...tempSettings.schedule, lateToleranceMinutes: parseInt(e.target.value) } })} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Jam Pulang</label>
                    <input type="time" className="w-full border border-slate-200 dark:border-slate-600 rounded-xl p-3 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" value={tempSettings.schedule.checkOutStart} onChange={e => setTempSettings({ ...tempSettings, schedule: { ...tempSettings.schedule, checkOutStart: e.target.value } })} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Tgl Mulai</label>
                    <input type="date" className="w-full border border-slate-200 dark:border-slate-600 rounded-xl p-3 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" value={tempSettings.schedule.startDate} onChange={e => setTempSettings({ ...tempSettings, schedule: { ...tempSettings.schedule, startDate: e.target.value } })} />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Tgl Selesai</label>
                    <input type="date" className="w-full border border-slate-200 dark:border-slate-600 rounded-xl p-3 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" value={tempSettings.schedule.endDate} onChange={e => setTempSettings({ ...tempSettings, schedule: { ...tempSettings.schedule, endDate: e.target.value } })} />
                  </div>
                </div>

                <div className="mt-8 flex justify-end">
                  <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 py-4 px-8 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none font-bold">Simpan Perubahan Global</Button>
                </div>
              </div>
            </form>

            {/* Special Schedule Section */}
            <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700">
              {/* ... (Existing Special Schedule Code) */}
              <h3 className="text-lg font-bold mb-6 text-slate-800 dark:text-white border-b border-slate-100 dark:border-slate-700 pb-3">Jadwal Khusus & Event (Satu Hari)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Nama Jadwal / Event</label>
                  <input type="text" placeholder="Contoh: Piket Sabtu" className="w-full border border-slate-200 dark:border-slate-600 rounded-xl p-3 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" value={newSpecial.name} onChange={e => setNewSpecial({ ...newSpecial, name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Tanggal</label>
                  <input type="date" className="w-full border border-slate-200 dark:border-slate-600 rounded-xl p-3 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" value={newSpecial.date} onChange={e => setNewSpecial({ ...newSpecial, date: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Jam Masuk</label>
                  <input type="time" className="w-full border border-slate-200 dark:border-slate-600 rounded-xl p-3 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" value={newSpecial.checkInDeadline} onChange={e => setNewSpecial({ ...newSpecial, checkInDeadline: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Jam Pulang</label>
                  <input type="time" className="w-full border border-slate-200 dark:border-slate-600 rounded-xl p-3 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white" value={newSpecial.checkOutStart} onChange={e => setNewSpecial({ ...newSpecial, checkOutStart: e.target.value })} />
                </div>
                <div className="md:col-span-2 bg-slate-50 dark:bg-slate-700/30 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50">
                  <h4 className="font-bold text-sm text-slate-700 dark:text-slate-300 mb-3">Override Lokasi (Opsional)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Koordinat Khusus (Lat, Lng)</label>
                      <input type="text" placeholder="-6.2000, 106.8000" className="w-full border border-slate-200 dark:border-slate-600 rounded-xl p-3 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-mono" value={newSpecial.overrideLocation} onChange={e => setNewSpecial({ ...newSpecial, overrideLocation: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Radius Khusus (Meter)</label>
                      <input type="number" placeholder="200" className="w-full border border-slate-200 dark:border-slate-600 rounded-xl p-3 bg-white dark:bg-slate-700 text-slate-900 dark:text-white" value={newSpecial.overrideRadius || ''} onChange={e => setNewSpecial({ ...newSpecial, overrideRadius: e.target.value ? parseInt(e.target.value) : undefined })} />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Biarkan kosong jika ingin menggunakan lokasi kantor utama.</p>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Pilih Peserta (Dapat memilih lebih dari satu)</label>
                  <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 p-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {users.filter(u => u.role === UserRole.INTERN).map(user => (
                      <label key={user.id} className="relative flex items-center gap-3 p-3 hover:bg-white dark:hover:bg-slate-600 rounded-xl cursor-pointer transition-all border border-transparent hover:border-indigo-100 dark:hover:border-slate-500 group select-none">
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          checked={newSpecial.assignedUserIds?.includes(user.id)}
                          onChange={() => toggleUserSelection(user.id)}
                        />
                        <div className="w-5 h-5 rounded-md border-2 border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-700 peer-checked:bg-indigo-600 peer-checked:border-indigo-600 transition-all duration-200 flex items-center justify-center shrink-0 shadow-sm group-hover:border-indigo-400">
                          <svg className="w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 transform scale-50 peer-checked:scale-100 transition-all duration-200 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="text-sm text-slate-700 dark:text-slate-200 truncate font-medium group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">{user.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-8 flex justify-end">
                <Button onClick={handleAddSpecialSchedule} className="bg-emerald-600 hover:bg-emerald-700 py-4 px-8 rounded-xl shadow-lg shadow-emerald-200 dark:shadow-none font-bold">Tambah Jadwal Khusus</Button>
              </div>
              <div className="mt-10 pt-8 border-t border-slate-100 dark:border-slate-700">
                <h4 className="text-md font-bold text-slate-700 dark:text-slate-300 mb-4">Daftar Jadwal Khusus Aktif</h4>
                <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-slate-700">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400">
                      <tr>
                        <th className="p-4">Nama Jadwal</th>
                        <th className="p-4">Tanggal</th>
                        <th className="p-4">Waktu</th>
                        <th className="p-4">Override Lokasi</th>
                        <th className="p-4">Peserta</th>
                        <th className="p-4 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
                      {(!tempSettings.specialSchedules || tempSettings.specialSchedules.length === 0) ? (
                        <tr><td colSpan={6} className="p-6 text-center text-slate-400">Belum ada jadwal khusus.</td></tr>
                      ) : (
                        tempSettings.specialSchedules.map(sch => (
                          <tr key={sch.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                            <td className="p-4 font-medium text-slate-800 dark:text-white">{sch.name}</td>
                            <td className="p-4 text-slate-600 dark:text-slate-300">{sch.date}</td>
                            <td className="p-4 text-slate-600 dark:text-slate-300 font-mono text-xs">{sch.checkInDeadline} - {sch.checkOutStart}</td>
                            <td className="p-4 text-slate-600 dark:text-slate-300 text-xs">
                              {sch.overrideLocation ? (
                                <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-1 rounded">Ya</span>
                              ) : <span className="text-slate-400">-</span>}
                            </td>
                            <td className="p-4 text-slate-600 dark:text-slate-300">
                              <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded text-xs font-bold">
                                {sch.assignedUserIds.length} Peserta
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <button
                                onClick={() => handleDeleteSpecialSchedule(sch.id)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors"
                                title="Hapus Jadwal"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
