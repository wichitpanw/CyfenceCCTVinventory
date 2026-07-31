/**
 * โมดัลอนุมัติ / ปฏิเสธคำขอ — รวมไว้ตัวเดียวเพราะฟอร์มต่างกันแค่ช่องเดียว
 */
import React, { useEffect, useState } from 'react';
import { CheckCircle, XOctagon } from 'lucide-react';
import Modal from '../ui/Modal';
import { BorrowRequest } from '../../types';
import { formatDate } from '../../lib/format';

interface Props {
  open: boolean;
  mode: 'approve' | 'reject';
  req: BorrowRequest | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (payload: { reviewer: string; note: string }) => void;
}

const REVIEWER_KEY = 'cyfence_last_reviewer';

export default function ApproveDialog({ open, mode, req, busy, onClose, onConfirm }: Props) {
  const [reviewer, setReviewer] = useState('');
  const [note, setNote] = useState('');

  // จำชื่อผู้ตรวจสอบคนล่าสุดไว้ ไม่ต้องพิมพ์ใหม่ทุกใบ
  useEffect(() => {
    if (open) {
      setReviewer(localStorage.getItem(REVIEWER_KEY) || '');
      setNote('');
    }
  }, [open, req?.id]);

  if (!req) return null;

  const isApprove = mode === 'approve';
  const canSubmit = reviewer.trim().length > 0 && !busy;

  const submit = () => {
    if (!canSubmit) return;
    localStorage.setItem(REVIEWER_KEY, reviewer.trim());
    onConfirm({ reviewer: reviewer.trim(), note: note.trim() });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isApprove ? 'อนุมัติคำขอเบิกพัสดุ' : 'ปฏิเสธคำขอเบิกพัสดุ'}
      subtitle={`${req.requester_name} · ${req.requester_company}`}
      icon={isApprove ? <CheckCircle className="h-5 w-5 text-emerald-600" /> : <XOctagon className="h-5 w-5 text-red-600" />}
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
            onClick={submit}
            disabled={!canSubmit}
            className={`py-3 px-4 text-white font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 ${
              isApprove ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {busy && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {isApprove ? 'ยืนยันการอนุมัติ' : 'ยืนยันการปฏิเสธ'}
          </button>
        </div>
      }
    >
      <div className="bg-[#F5F5F7] rounded-2xl p-4 space-y-1.5 text-xs">
        <p className="text-[#6E6E73]">
          รหัสใบเบิก: <span className="font-mono font-bold text-[#1D1D1F]">{req.id}</span>
        </p>
        <p className="text-[#6E6E73]">
          รายการ: <span className="font-bold text-[#1D1D1F]">{req.items.length} ชนิด · {req.items.reduce((s, i) => s + i.qty, 0)} ชิ้น</span>
        </p>
        <p className="text-[#6E6E73]">
          กำหนดคืน: <span className="font-bold text-[#1D1D1F]">{formatDate(req.requested_due_date)}</span>
        </p>
      </div>

      {isApprove && (
        <p className="text-xs text-[#6E6E73] leading-relaxed bg-amber-50 border border-amber-200 rounded-xl p-3">
          การอนุมัติยัง<b>ไม่ตัดสต็อก</b> — สต็อกจะถูกตัดตอนกด "จ่ายพัสดุออกจากคลัง" และระบบจะตรวจยอดคงเหลืออีกครั้งในตอนนั้น
        </p>
      )}

      <div className="space-y-1.5">
        <label className="block text-[11px] font-bold text-[#86868B] uppercase tracking-wider">
          ชื่อผู้ดำเนินการ *
        </label>
        <input
          type="text"
          autoFocus
          value={reviewer}
          onChange={e => setReviewer(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="เช่น แอดมินวิชัย"
          className="w-full px-3 py-2.5 bg-white border border-[#E8E8ED] rounded-xl text-xs focus:outline-none focus:border-[#1D1D1F] transition"
        />
      </div>

      <div className="space-y-1.5">
        <label className="block text-[11px] font-bold text-[#86868B] uppercase tracking-wider">
          หมายเหตุ {isApprove ? '(ไม่บังคับ)' : '— เหตุผลที่ปฏิเสธ'}
        </label>
        <textarea
          rows={3}
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder={isApprove ? 'เช่น อนุมัติตามที่ขอ' : 'เช่น อุปกรณ์ถูกจองไว้สำหรับงานอื่นแล้ว'}
          className="w-full px-3 py-2.5 bg-white border border-[#E8E8ED] rounded-xl text-xs focus:outline-none focus:border-[#1D1D1F] transition resize-none"
        />
      </div>
    </Modal>
  );
}
