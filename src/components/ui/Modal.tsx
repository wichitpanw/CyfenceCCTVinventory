/**
 * โมดัลกลางของระบบ — หัวเรื่อง / เนื้อหาเลื่อนได้ / แถบปุ่มติดขอบล่าง
 * ปิดด้วย Esc หรือคลิกพื้นหลัง และล็อกการเลื่อนหน้าเบื้องหลังไว้
 */
import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  /** แถบปุ่มติดขอบล่าง */
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl' };

export default function Modal({ open, onClose, title, subtitle, icon, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center bg-[#1D1D1F]/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`w-full ${SIZES[size]} bg-white sm:rounded-3xl rounded-t-3xl border border-[#E8E8ED] shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh] animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200`}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-[#E8E8ED] shrink-0">
          {icon && <div className="p-2.5 rounded-2xl bg-[#F5F5F7] shrink-0">{icon}</div>}
          <div className="flex-1 min-w-0 text-left">
            <h3 className="text-sm font-bold text-[#1D1D1F]">{title}</h3>
            {subtitle && <p className="text-xs text-[#6E6E73] mt-0.5 leading-relaxed">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-[#86868B] hover:bg-[#F5F5F7] hover:text-[#1D1D1F] transition cursor-pointer shrink-0"
            aria-label="ปิด"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-left">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="p-4 border-t border-[#E8E8ED] bg-[#FBFBFD] sm:rounded-b-3xl shrink-0">{footer}</div>
        )}
      </div>
    </div>
  );
}
