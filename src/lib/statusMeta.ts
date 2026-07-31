/**
 * ป้ายสถานะชุดเดียวของทั้งระบบ
 * เดิม ApprovalView กับ RequestStatusView นิยามแยกกัน ทำให้ผู้ขอเห็น "รอการอนุมัติ"
 * แต่แอดมินเห็น "รอ Approve" ในสถานะเดียวกัน
 */
import { BorrowRequest } from '../types';

export interface StatusMeta {
  label: string;
  short: string;
  /** คลาสสีพร้อมใช้กับ badge */
  className: string;
  /** ลำดับในไทม์ไลน์ (-1 = จบแบบไม่สำเร็จ) */
  step: number;
}

export const REQUEST_STATUS: Record<BorrowRequest['status'], StatusMeta> = {
  pending_approval: {
    label: 'รอการอนุมัติ',
    short: 'รออนุมัติ',
    className: 'bg-amber-50 border-amber-200 text-amber-700',
    step: 1,
  },
  approved: {
    label: 'อนุมัติแล้ว (รอจ่ายพัสดุ)',
    short: 'รอจ่ายพัสดุ',
    className: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    step: 2,
  },
  borrowing: {
    label: 'กำลังยืมใช้งาน',
    short: 'กำลังยืม',
    className: 'bg-blue-50 border-blue-200 text-blue-700',
    step: 3,
  },
  returned: {
    label: 'คืนคลังครบแล้ว',
    short: 'คืนแล้ว',
    className: 'bg-slate-100 border-slate-200 text-slate-600',
    step: 4,
  },
  rejected: {
    label: 'ปฏิเสธคำขอ',
    short: 'ปฏิเสธ',
    className: 'bg-red-50 border-red-200 text-red-700',
    step: -1,
  },
  cancelled: {
    label: 'ยกเลิกคำขอ',
    short: 'ยกเลิก',
    className: 'bg-slate-50 border-slate-200 text-slate-500',
    step: -1,
  },
};

export const REQUEST_STEPS = ['ยื่นคำขอ', 'อนุมัติ', 'จ่ายพัสดุ', 'คืนครบ'] as const;

export function statusMeta(status: BorrowRequest['status']): StatusMeta {
  return REQUEST_STATUS[status] ?? {
    label: status,
    short: status,
    className: 'bg-slate-50 border-slate-200 text-slate-600',
    step: 0,
  };
}

export const CONDITION_LABELS: Record<'available' | 'maintenance' | 'broken', string> = {
  available: 'ปกติ (พร้อมใช้งาน)',
  maintenance: 'ส่งซ่อมบำรุง',
  broken: 'ชำรุดเสียหาย',
};
