/**
 * โมดัลยืนยันสำหรับงานที่ย้อนกลับยาก (ดึงใบเบิกกลับ / ลบใบเบิก)
 */
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from '../ui/Modal';

interface Props {
  open: boolean;
  title: string;
  subtitle?: string;
  /** ผลกระทบที่จะเกิดขึ้นจริง แสดงเป็นรายการ */
  consequences: string[];
  confirmLabel: string;
  tone?: 'danger' | 'neutral';
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  children?: React.ReactNode;
}

export default function ConfirmDialog({
  open,
  title,
  subtitle,
  consequences,
  confirmLabel,
  tone = 'danger',
  busy,
  onClose,
  onConfirm,
  children,
}: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      icon={<AlertTriangle className={`h-5 w-5 ${tone === 'danger' ? 'text-red-600' : 'text-amber-600'}`} />}
      footer={
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="py-3 px-4 border border-[#E8E8ED] hover:bg-[#F5F5F7] text-[#1D1D1F] font-bold text-xs rounded-xl transition cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`py-3 px-4 text-white font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              tone === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-[#1D1D1F] hover:bg-black'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      {children}
      <div className={`rounded-2xl p-4 border ${tone === 'danger' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
        <p className={`text-xs font-bold mb-2 ${tone === 'danger' ? 'text-red-800' : 'text-amber-800'}`}>
          สิ่งที่จะเกิดขึ้น
        </p>
        <ul className={`space-y-1.5 text-xs leading-relaxed ${tone === 'danger' ? 'text-red-700' : 'text-amber-800'}`}>
          {consequences.map((c, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden="true">•</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
