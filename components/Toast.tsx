import React, { useEffect } from 'react';

export interface ToastProps {
  isVisible: boolean;
  title: string;
  description?: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ isVisible, title, description, type, onClose }) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, 3000); // Hilang otomatis setelah 3 detik
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  const bgColors = {
    success: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800',
    error: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800',
    info: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800'
  };

  const iconColors = {
    success: 'text-emerald-500 dark:text-emerald-400',
    error: 'text-red-500 dark:text-red-400',
    info: 'text-blue-500 dark:text-blue-400'
  };

  const icons = {
    success: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    info: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  };

  return (
    <div className="fixed top-4 right-4 z-[100] animate-slide-in-right">
      <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-md max-w-sm ${bgColors[type]}`}>
        <div className={`mt-0.5 ${iconColors[type]}`}>
          {icons[type]}
        </div>
        <div className="flex-1">
          <h4 className={`text-sm font-bold ${type === 'error' ? 'text-red-800 dark:text-red-200' : type === 'success' ? 'text-emerald-800 dark:text-emerald-200' : 'text-blue-800 dark:text-blue-200'}`}>
            {title}
          </h4>
          {description && (
            <p className={`text-xs mt-1 ${type === 'error' ? 'text-red-600 dark:text-red-300' : type === 'success' ? 'text-emerald-600 dark:text-emerald-300' : 'text-blue-600 dark:text-blue-300'}`}>
              {description}
            </p>
          )}
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};