/**
 * ApprovalView.tsx — หน้าอนุมัติ / จ่าย / รับคืนใบเบิกพัสดุสำหรับผู้ดูแลระบบ
 *
 * โครงสร้าง: หน้านี้ดูแลแค่การโหลดข้อมูล ตัวกรอง และการเรียก API
 * ส่วนการ์ดและฟอร์มแต่ละงานแยกไปอยู่ใน components/approval/*
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ShieldCheck, RefreshCw, Filter, X, Image as ImageIcon } from 'lucide-react';
import { BorrowRequest, Equipment, SupabaseConfig, ReturnItemInput } from '../types';
import {
  getBorrowRequests,
  getEquipments,
  updateBorrowRequestStatus,
  updateBorrowRequestItems,
  dispatchBorrowRequest,
  returnBorrowRequestItems,
  revertEntireBorrowRequestReturn,
  deleteBorrowRequest,
} from '../services/db';
import { useToast } from './ui/Toast';
import RequestCard, { returnedQtyOf } from './approval/RequestCard';
import ApproveDialog from './approval/ApproveDialog';
import DispatchDialog from './approval/DispatchDialog';
import ReturnDialog from './approval/ReturnDialog';
import ConfirmDialog from './approval/ConfirmDialog';

interface ApprovalViewProps {
  config: SupabaseConfig;
  refreshTrigger: number;
  onRefresh: () => void;
}

type FilterStatus = 'all' | 'pending_approval' | 'approved' | 'borrowing' | 'returned' | 'rejected';

const FILTER_TABS: [FilterStatus, string][] = [
  ['pending_approval', 'รออนุมัติ'],
  ['approved', 'รอจ่ายพัสดุ'],
  ['borrowing', 'กำลังยืม'],
  ['returned', 'คืนแล้ว'],
  ['rejected', 'ปฏิเสธ'],
  ['all', 'ทั้งหมด'],
];

type DialogState =
  | { kind: 'none' }
  | { kind: 'approve' | 'reject' | 'dispatch' | 'return' | 'revert' | 'delete'; req: BorrowRequest };

export default function ApprovalView({ config, refreshTrigger, onRefresh }: ApprovalViewProps) {
  const toast = useToast();

  const [requests, setRequests] = useState<BorrowRequest[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ kind: 'none' });
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState<FilterStatus>('pending_approval');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterRequestDate, setFilterRequestDate] = useState('');
  const [filterDueDate, setFilterDueDate] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [reqs, eqs] = await Promise.all([getBorrowRequests(config), getEquipments(config)]);
      setRequests(reqs);
      setEquipments(eqs);
    } catch (e: any) {
      toast.error(e?.message || 'โหลดข้อมูลใบเบิกไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [config, toast]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, refreshTrigger]);

  /** ยอดที่ถูกใบซึ่งอนุมัติแล้วแต่ยังไม่จ่ายจองไว้ ใช้เตือนไม่ให้อนุมัติเกินของจริง */
  const committedByEquipment = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of requests) {
      if (r.status !== 'approved') continue;
      for (const item of r.items) {
        map[item.equipment_id] = (map[item.equipment_id] || 0) + item.qty;
      }
    }
    return map;
  }, [requests]);

  const counts = useMemo(
    () => ({
      pending: requests.filter(r => r.status === 'pending_approval').length,
      approved: requests.filter(r => r.status === 'approved').length,
      borrowing: requests.filter(r => r.status === 'borrowing').length,
    }),
    [requests]
  );

  const filtered = useMemo(
    () =>
      requests.filter(r => {
        if (filterStatus !== 'all' && r.status !== filterStatus) return false;
        if (filterCompany.trim() && !(r.requester_company || '').toLowerCase().includes(filterCompany.toLowerCase().trim()))
          return false;
        if (filterRequestDate && new Date(r.created_at).toLocaleDateString('en-CA') !== filterRequestDate) return false;
        if (filterDueDate && new Date(r.requested_due_date).toLocaleDateString('en-CA') !== filterDueDate) return false;
        return true;
      }),
    [requests, filterStatus, filterCompany, filterRequestDate, filterDueDate]
  );

  const hasFilters = !!(filterCompany || filterRequestDate || filterDueDate);
  const clearFilters = () => {
    setFilterCompany('');
    setFilterRequestDate('');
    setFilterDueDate('');
  };

  /** ตัวห่อสำหรับทุก action: จัดการสถานะ busy / toast / โหลดข้อมูลใหม่ ในที่เดียว */
  const runAction = async (req: BorrowRequest, successMessage: string, fn: () => Promise<unknown>) => {
    setBusyId(req.id);
    try {
      await fn();
      setDialog({ kind: 'none' });
      toast.success(successMessage);
      await loadData();
      onRefresh();
    } catch (e: any) {
      toast.error(e?.message || 'ดำเนินการไม่สำเร็จ');
    } finally {
      setBusyId(null);
    }
  };

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleApprove = (req: BorrowRequest, reviewer: string, note: string) =>
    runAction(req, `อนุมัติคำขอของ ${req.requester_name} แล้ว — ขั้นถัดไปคือจ่ายพัสดุออกจากคลัง`, () =>
      updateBorrowRequestStatus(config, req.id, 'approved', { reviewedBy: reviewer, adminNote: note })
    );

  const handleReject = (req: BorrowRequest, reviewer: string, note: string) =>
    runAction(req, `ปฏิเสธคำขอของ ${req.requester_name} แล้ว`, () =>
      updateBorrowRequestStatus(config, req.id, 'rejected', { reviewedBy: reviewer, adminNote: note })
    );

  const handleDispatch = (req: BorrowRequest, evidenceImageUrl: string, dispatchedBy: string) =>
    runAction(req, 'จ่ายพัสดุออกจากคลังแล้ว — ระบบตัดสต็อกและสร้างประวัติการยืมเรียบร้อย', () =>
      dispatchBorrowRequest(config, req.id, evidenceImageUrl, dispatchedBy)
    );

  const handleReturn = (req: BorrowRequest, items: ReturnItemInput[], returnerName: string) => {
    const total = items.reduce((s, i) => s + i.qty, 0);
    const willBeComplete = req.items.every(item => {
      const returning = items.find(i => i.equipment_id === item.equipment_id)?.qty ?? 0;
      return returnedQtyOf(item, req) + returning >= item.qty;
    });
    return runAction(
      req,
      willBeComplete
        ? `รับคืนครบทั้งใบแล้ว (${total} ชิ้น) — ใบเบิกนี้ปิดเรียบร้อย`
        : `บันทึกรับคืน ${total} ชิ้นแล้ว — ใบเบิกยังมีรายการค้างอยู่`,
      () => returnBorrowRequestItems(config, req.id, items, returnerName)
    );
  };

  const handleRevert = (req: BorrowRequest) =>
    runAction(req, 'ดึงใบเบิกกลับมาเป็นสถานะกำลังยืมแล้ว — สต็อกถูกหักกลับตามสภาพที่เคยคืน', () =>
      revertEntireBorrowRequestReturn(config, req.id)
    );

  const handleDelete = (req: BorrowRequest) =>
    runAction(req, 'ลบใบคำขอเบิกเรียบร้อยแล้ว', () => deleteBorrowRequest(config, req.id));

  const handleEditQty = async (req: BorrowRequest, equipmentId: string, nextQty: number) => {
    const eq = equipments.find(e => e.id === equipmentId);
    const committedElsewhere = Math.max(
      0,
      (committedByEquipment[equipmentId] || 0) - (req.items.find(i => i.equipment_id === equipmentId)?.qty || 0)
    );
    const max = Math.max(1, (eq?.available_qty ?? 0) - committedElsewhere);
    const clamped = Math.max(1, Math.min(max, nextQty));

    const updatedItems = req.items.map(i => (i.equipment_id === equipmentId ? { ...i, qty: clamped } : i));
    setRequests(prev => prev.map(r => (r.id === req.id ? { ...r, items: updatedItems } : r)));

    try {
      await updateBorrowRequestItems(config, req.id, updatedItems);
    } catch (e: any) {
      toast.error(e?.message || 'ปรับจำนวนไม่สำเร็จ');
      await loadData();
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const activeReq = dialog.kind === 'none' ? null : dialog.req;

  return (
    <div className="space-y-6 text-left" id="approval-view-wrapper">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-bold text-[#1D1D1F] uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            หน้าอนุมัติคำขอเบิกพัสดุ
          </h2>
          <p className="text-xs text-[#6E6E73] mt-0.5">ตรวจสอบ · อนุมัติ / ปฏิเสธ · จ่ายพัสดุ · รับคืนเข้าคลัง</p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#F5F5F7] border border-[#E8E8ED] rounded-xl text-xs font-semibold text-[#1D1D1F] hover:bg-[#E8E8ED] transition cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" /> รีเฟรช
        </button>
      </div>

      {/* สรุปตัวเลข — กดเพื่อกรอง */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { key: 'pending_approval' as FilterStatus, label: 'รออนุมัติ', count: counts.pending, cls: 'text-amber-600 bg-amber-50 border-amber-200' },
          { key: 'approved' as FilterStatus, label: 'รอจ่ายพัสดุ', count: counts.approved, cls: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
          { key: 'borrowing' as FilterStatus, label: 'กำลังยืม', count: counts.borrowing, cls: 'text-blue-600 bg-blue-50 border-blue-200' },
        ].map(s => (
          <button
            key={s.key}
            type="button"
            onClick={() => setFilterStatus(s.key)}
            className={`border rounded-2xl p-4 text-center transition cursor-pointer hover:brightness-95 ${s.cls} ${
              filterStatus === s.key ? 'ring-2 ring-[#1D1D1F]/15' : ''
            }`}
          >
            <p className="text-2xl font-extrabold">{s.count}</p>
            <p className="text-[11px] text-[#6E6E73] font-semibold mt-0.5">{s.label}</p>
          </button>
        ))}
      </div>

      {/* แท็บสถานะ */}
      <div className="bg-[#F5F5F7] p-1 rounded-2xl flex gap-1 overflow-x-auto">
        {FILTER_TABS.map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilterStatus(val)}
            className={`flex-1 min-w-fit whitespace-nowrap px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              filterStatus === val ? 'bg-white text-[#1D1D1F] shadow-sm' : 'text-[#6E6E73] hover:text-[#1D1D1F]'
            }`}
          >
            {label}
            {val === 'pending_approval' && counts.pending > 0 ? ` (${counts.pending})` : ''}
          </button>
        ))}
      </div>

      {/* ตัวกรองเพิ่มเติม */}
      <div className="bg-white border border-[#E8E8ED] p-4 rounded-2xl space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs font-bold text-[#1D1D1F] flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5" /> ตัวกรองเพิ่มเติม
          </span>
          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-red-600 hover:text-red-700 font-bold transition cursor-pointer">
              ล้างตัวกรองทั้งหมด
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FilterField label="บริษัท / หน่วยงาน">
            <input
              type="text"
              placeholder="เช่น Insider"
              value={filterCompany}
              onChange={e => setFilterCompany(e.target.value)}
              className="w-full px-3 py-2 bg-[#F5F5F7] border border-[#E8E8ED] rounded-xl text-xs focus:outline-none focus:border-[#1D1D1F] transition"
            />
          </FilterField>
          <FilterField label="วันที่ยื่นคำขอ">
            <input
              type="date"
              value={filterRequestDate}
              onChange={e => setFilterRequestDate(e.target.value)}
              className="w-full px-3 py-2 bg-[#F5F5F7] border border-[#E8E8ED] rounded-xl text-xs focus:outline-none focus:border-[#1D1D1F] transition"
            />
          </FilterField>
          <FilterField label="กำหนดส่งคืน">
            <input
              type="date"
              value={filterDueDate}
              onChange={e => setFilterDueDate(e.target.value)}
              className="w-full px-3 py-2 bg-[#F5F5F7] border border-[#E8E8ED] rounded-xl text-xs focus:outline-none focus:border-[#1D1D1F] transition"
            />
          </FilterField>
        </div>
      </div>

      {/* รายการใบเบิก */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="bg-white border border-[#E8E8ED] rounded-2xl p-4 space-y-3 animate-pulse">
              <div className="h-4 w-32 bg-[#F5F5F7] rounded-full" />
              <div className="h-3 w-48 bg-[#F5F5F7] rounded-full" />
              <div className="h-3 w-64 bg-[#F5F5F7] rounded-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center bg-white border border-[#E8E8ED] rounded-2xl p-4">
          <Filter className="h-8 w-8 text-[#C7C7CC]" />
          <p className="text-sm text-[#6E6E73] font-medium">ไม่พบใบเบิกที่ตรงกับเงื่อนไขที่เลือก</p>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-[#1D1D1F] text-white rounded-xl text-xs font-semibold hover:bg-black transition cursor-pointer"
            >
              ล้างตัวกรองทั้งหมด
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(req => (
            <RequestCard
              key={req.id}
              req={req}
              equipments={equipments}
              committedByEquipment={committedByEquipment}
              expanded={expandedId === req.id}
              busy={busyId === req.id}
              onToggle={() => setExpandedId(expandedId === req.id ? null : req.id)}
              onApprove={() => setDialog({ kind: 'approve', req })}
              onReject={() => setDialog({ kind: 'reject', req })}
              onDispatch={() => setDialog({ kind: 'dispatch', req })}
              onReturn={() => setDialog({ kind: 'return', req })}
              onRevert={() => setDialog({ kind: 'revert', req })}
              onDelete={() => setDialog({ kind: 'delete', req })}
              onEditQty={(equipmentId, qty) => handleEditQty(req, equipmentId, qty)}
              onViewImage={setLightboxUrl}
            />
          ))}
        </div>
      )}

      {/* ── โมดัลต่าง ๆ ── */}
      <ApproveDialog
        open={dialog.kind === 'approve' || dialog.kind === 'reject'}
        mode={dialog.kind === 'reject' ? 'reject' : 'approve'}
        req={activeReq}
        busy={!!busyId}
        onClose={() => setDialog({ kind: 'none' })}
        onConfirm={({ reviewer, note }) => {
          if (!activeReq) return;
          dialog.kind === 'reject'
            ? handleReject(activeReq, reviewer, note)
            : handleApprove(activeReq, reviewer, note);
        }}
      />

      <DispatchDialog
        open={dialog.kind === 'dispatch'}
        req={activeReq}
        equipments={equipments}
        busy={!!busyId}
        onClose={() => setDialog({ kind: 'none' })}
        onConfirm={({ evidenceImageUrl, dispatchedBy }) =>
          activeReq && handleDispatch(activeReq, evidenceImageUrl, dispatchedBy)
        }
      />

      <ReturnDialog
        open={dialog.kind === 'return'}
        req={activeReq}
        busy={!!busyId}
        onClose={() => setDialog({ kind: 'none' })}
        onConfirm={({ items, returnerName }) => activeReq && handleReturn(activeReq, items, returnerName)}
      />

      <ConfirmDialog
        open={dialog.kind === 'revert'}
        title="ดึงใบเบิกกลับเป็นกำลังยืม"
        subtitle={activeReq ? `${activeReq.requester_name} · ${activeReq.id}` : undefined}
        tone="neutral"
        confirmLabel="ดึงกลับเป็นกำลังยืม"
        busy={!!busyId}
        consequences={[
          'ยอดพัสดุที่เคยบันทึกคืนไว้จะถูกหักออกจากคลังกลับไปเป็น "ยืมอยู่"',
          'ระบบจะหักออกจากช่องเดิมที่เคยคืนเข้าไป (พร้อมใช้ / ส่งซ่อม / ชำรุด) ตามที่บันทึกไว้จริง',
          'กรุณาตรวจว่าอุปกรณ์จริงยังอยู่กับผู้ยืม ก่อนกดยืนยัน',
        ]}
        onClose={() => setDialog({ kind: 'none' })}
        onConfirm={() => activeReq && handleRevert(activeReq)}
      />

      <ConfirmDialog
        open={dialog.kind === 'delete'}
        title="ลบใบคำขอเบิกพัสดุ"
        subtitle={activeReq ? `${activeReq.requester_name} · ${activeReq.id}` : undefined}
        confirmLabel="ลบถาวร"
        busy={!!busyId}
        consequences={
          activeReq && (activeReq.status === 'borrowing' || activeReq.status === 'returned')
            ? [
                'ใบเบิกนี้จ่ายพัสดุออกไปแล้ว — ระบบจะย้อนผลกระทบต่อสต็อกให้ทั้งหมด',
                'พัสดุที่ยังยืมอยู่จะถูกคืนกลับเข้าช่องพร้อมใช้ และพัสดุที่คืนแล้วจะถูกหักออกจากช่องที่เคยคืนเข้าไป',
                'ประวัติการยืม-คืนทั้งหมดของใบนี้จะถูกลบถาวร ย้อนกลับไม่ได้',
              ]
            : [
                'ใบเบิกนี้ยังไม่ได้จ่ายพัสดุออกจากคลัง จึงไม่มีผลต่อจำนวนสต็อก',
                'ข้อมูลใบคำขอจะถูกลบถาวร ย้อนกลับไม่ได้',
              ]
        }
        onClose={() => setDialog({ kind: 'none' })}
        onConfirm={() => activeReq && handleDelete(activeReq)}
      />

      {/* Lightbox รูปหลักฐาน */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-[#1D1D1F]/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-4xl w-full bg-white rounded-3xl p-4 border border-[#E8E8ED]" onClick={e => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setLightboxUrl(null)}
              className="absolute top-4 right-4 p-2 bg-white/90 hover:bg-[#F5F5F7] text-[#1D1D1F] rounded-full transition cursor-pointer z-10 border border-[#E8E8ED]"
              aria-label="ปิดรูป"
            >
              <X className="w-4 h-4" />
            </button>
            <img src={lightboxUrl} alt="หลักฐานใบเบิก" className="w-full max-h-[75vh] object-contain rounded-2xl" />
            <p className="mt-3 text-xs font-semibold text-[#6E6E73] flex items-center justify-center gap-2">
              <ImageIcon className="w-4 h-4" /> ภาพหลักฐานใบเบิกคลังอุปกรณ์
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-wider block">{label}</label>
      {children}
    </div>
  );
}
