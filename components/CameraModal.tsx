import React, { useRef, useEffect, useState } from 'react';
import { Button } from './Button';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (base64Image: string) => void;
}

export const CameraModal: React.FC<CameraModalProps> = ({ isOpen, onClose, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isOpen]);

  const startCamera = async () => {
    try {
      // Mengutamakan kamera depan (user) dan resolusi ideal
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: { ideal: 720 } 
        } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      alert("Tidak dapat mengakses kamera. Pastikan izin diberikan.");
      onClose();
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context && video.videoWidth > 0) {
        // --- LOGIKA OPTIMASI GAMBAR ---
        
        // 1. Tentukan Ukuran Target (Max Width 480px cukup untuk bukti absen)
        const MAX_WIDTH = 480;
        let width = video.videoWidth;
        let height = video.videoHeight;

        // 2. Hitung Skala Aspek Rasio
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }

        // 3. Set Ukuran Canvas
        canvas.width = width;
        canvas.height = height;

        // 4. Gambar Video ke Canvas (Resize terjadi di sini)
        // Flip horizontal karena mode selfie
        context.translate(width, 0);
        context.scale(-1, 1);
        context.drawImage(video, 0, 0, width, height);

        // 5. Kompresi JPEG (Quality 0.6 atau 60%)
        // Ini drastis mengurangi ukuran file Base64
        const compressedImage = canvas.toDataURL('image/jpeg', 0.6);
        
        onCapture(compressedImage);
        stopCamera();
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-md border border-white/20 dark:border-slate-700">
        <h3 className="text-xl font-bold mb-4 text-slate-800 dark:text-white">Ambil Foto Selfie</h3>
        <div className="relative bg-black rounded-xl overflow-hidden aspect-video mb-6 shadow-inner border border-slate-200 dark:border-slate-700">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="w-full h-full object-cover transform scale-x-[-1]" 
          />
          <canvas ref={canvasRef} className="hidden" />
        </div>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={onClose} className="dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600">Batal</Button>
          <Button onClick={handleCapture} className="bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600">Ambil & Masuk</Button>
        </div>
      </div>
    </div>
  );
};