import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { User } from '../types';
import { getStoredUsers, saveUser } from '../services/storageService';

interface ForgotPasswordProps {
  onBackToLogin: () => void;
  onShowToast: (title: string, description: string, type: 'success' | 'error' | 'info') => void;
}

export const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onBackToLogin, onShowToast }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [targetUser, setTargetUser] = useState<User | null>(null);

  // Countdown timer effect
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendCode = (e: React.FormEvent) => {
    e.preventDefault();
    const users = getStoredUsers();
    // Assuming username is treated as email or unique identifier for now
    const user = users.find(u => u.username === email || u.id === email); // Simplification

    if (user) {
      setTargetUser(user);
      setStep(2);
      setCountdown(60);
      onShowToast('Kode Terkirim', 'Kode OTP telah dikirim ke email Anda (Mock: 123456)', 'success');
    } else {
      onShowToast('Gagal', 'Username/Email tidak ditemukan.', 'error');
    }
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp === '123456') { // Mock OTP
      setStep(3);
      onShowToast('Sukses', 'Kode OTP valid. Silakan buat password baru.', 'success');
    } else {
      onShowToast('Gagal', 'Kode OTP salah.', 'error');
    }
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 4) {
      onShowToast('Password Lemah', 'Password minimal 6 karakter', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      onShowToast('Gagal', 'Konfirmasi password tidak cocok', 'error');
      return;
    }

    if (targetUser) {
      const updatedUser = { ...targetUser, password: newPassword };
      saveUser(updatedUser);
      onShowToast('Berhasil', 'Password berhasil diubah. Silakan login.', 'success');
      onBackToLogin();
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
          {step === 1 ? 'Lupa Password' : step === 2 ? 'Verifikasi OTP' : 'Buat Password Baru'}
        </h2>
        <p className="text-slate-500 dark:text-slate-400">
          {step === 1 ? 'Masukkan username Anda untuk mereset password.' : 
           step === 2 ? 'Masukkan 6 digit kode yang kami kirim.' : 
           'Amankan akun Anda dengan password baru.'}
        </p>
      </div>

      {step === 1 && (
        <form onSubmit={handleSendCode} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Username</label>
            <input 
              type="text" 
              required 
              className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all placeholder-slate-400 dark:placeholder-slate-500 text-slate-800 dark:text-white"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Masukkan username"
            />
          </div>
          <Button type="submit" className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white">
            Kirim Kode OTP
          </Button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleVerifyOtp} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Kode OTP</label>
            <input 
              type="text" 
              required 
              maxLength={6}
              className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all placeholder-slate-400 dark:placeholder-slate-500 text-slate-800 dark:text-white text-center tracking-widest text-2xl"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="000000"
            />
          </div>
          <Button type="submit" className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white">
            Verifikasi Kode
          </Button>
          <div className="text-center">
            {countdown > 0 ? (
               <p className="text-sm text-slate-500">Kirim ulang dalam {countdown}s</p>
            ) : (
               <button type="button" onClick={handleSendCode} className="text-sm text-indigo-600 hover:underline font-semibold">Kirim Ulang Kode</button>
            )}
          </div>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={handleResetPassword} className="space-y-6">
           <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Password Baru</label>
            <input 
              type="password" 
              required 
              className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all placeholder-slate-400 dark:placeholder-slate-500 text-slate-800 dark:text-white"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Konfirmasi Password</label>
            <input 
              type="password" 
              required 
              className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all placeholder-slate-400 dark:placeholder-slate-500 text-slate-800 dark:text-white"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Ulangi password baru"
            />
          </div>
          <Button type="submit" className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white">
            Simpan Password Baru
          </Button>
        </form>
      )}

      <div className="mt-8 text-center">
        <button onClick={onBackToLogin} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-sm font-medium">
          ← Kembali ke Halaman Login
        </button>
      </div>
    </div>
  );
};
