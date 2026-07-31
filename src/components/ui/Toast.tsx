/**
 * Toast กลางของระบบ — แทนข้อความ success/error ที่เดิมฝังอยู่ในการ์ดและค้างอยู่จนกว่าจะรีโหลด
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** ใช้ใน component ใดก็ได้ที่อยู่ใต้ <ToastProvider> */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast ต้องอยู่ภายใน <ToastProvider>');
  return ctx;
}

const STYLES: Record<ToastKind, { wrap: string; icon: React.ReactNode }> = {
  success: {
    wrap: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />,
  },
  error: {
    wrap: 'bg-red-50 border-red-200 text-red-800',
    icon: <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />,
  },
  info: {
    wrap: 'bg-white border-[#E8E8ED] text-[#1D1D1F]',
    icon: <Info className="h-4 w-4 text-[#1D1D1F] shrink-0" />,
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((kind: ToastKind, message: string) => {
    // ข้อความยาว (เช่นรายการสต็อกไม่พอหลายบรรทัด) ให้เวลาอ่านนานขึ้น
    const id = Date.now() + Math.random();
    setItems(prev => [...prev, { id, kind, message }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setItems(prev => prev.filter(t => t.id !== id));
  }, []);

  const api: ToastApi = {
    success: useCallback((m: string) => push('success', m), [push]),
    error: useCallback((m: string) => push('error', m), [push]),
    info: useCallback((m: string) => push('info', m), [push]),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[200] flex flex-col gap-2 items-stretch sm:items-end pointer-events-none">
        {items.map(t => (
          <Toast key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const style = STYLES[item.kind];
  const duration = item.kind === 'error' ? 8000 : 4000;

  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-2.5 w-full sm:max-w-sm px-4 py-3 rounded-2xl border shadow-lg text-xs font-medium leading-relaxed whitespace-pre-line animate-in slide-in-from-bottom-2 fade-in duration-200 ${style.wrap}`}
    >
      <span className="mt-0.5">{style.icon}</span>
      <p className="flex-1">{item.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 opacity-50 hover:opacity-100 transition cursor-pointer"
        aria-label="ปิดข้อความแจ้งเตือน"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
