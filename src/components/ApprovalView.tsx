/**
 * ApprovalView.tsx — Admin Approval Panel (PIN-gated: 8888)
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  Package,
  ChevronDown,
  ChevronUp,
  User,
  Briefcase,
  Calendar,
  FileText,
  AlertCircle,
  RefreshCw,
  Filter,
  Lock,
  CheckCircle2,
  XOctagon,
  Truck,
  RotateCcw,
  Phone,
  Image as ImageIcon,
  ShieldCheck,
} from 'lucide-react';
import { BorrowRequest, SupabaseConfig, Equipment } from '../types';
import {
  getBorrowRequests,
  updateBorrowRequestStatus,
  borrowEquipment,
  getEquipments,
} from '../services/db';

interface ApprovalViewProps {
  config: SupabaseConfig;
  refreshTrigger: number;
  onRefresh: () => void;
}

type FilterStatus = 'all' | 'pending_approval' | 'approved' | 'rejected' | 'borrowing' | 'returned';

const STATUS_LABELS: Record<BorrowRequest['status'], { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending_approval: { label: 'รอการอนุมัติ', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: <Clock className="h-3.5 w-3.5" /> },
  approved: { label: 'อนุมัติแล้ว', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: <CheckCircle className="h-3.5 w-3.5" /> },
  rejected: { label: 'ปฏิเสธ', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: <XCircle className="h-3.5 w-3.5" /> },
  borrowing: { label: 'กำลังยืมอยู่', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: <Truck className="h-3.5 w-3.5" /> },
  returned: { label: 'คืนแล้ว', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  cancelled: { label: 'ยกเลิก', color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200', icon: <XOctagon className="h-3.5 w-3.5" /> },
};

const ADMIN_PIN = '8888';

export default function ApprovalView({ config, refreshTrigger, onRefresh }: ApprovalViewProps) {
  // ── PIN Gate ────────────────────────────────────────────────────────────────
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(() =>
    sessionStorage.getItem('admin_approval_unlocked') === 'true'
  );

  const handlePinKey = useCallback((num: string) => {
    setPinError(false);
    if (pin.length < 4) {
      const next = pin + num;
      setPin(next);
      if (next === ADMIN_PIN) {
        setTimeout(() => {
          sessionStorage.setItem('admin_approval_unlocked', 'true');
          setIsUnlocked(true);
        }, 200);
      } else if (next.length === 4) {
        setTimeout(() => {
          setPinError(true);
          setTimeout(() => setPin(''), 600);
        }, 150);
      }
    }
  }, [pin]);

  useEffect(() => {
    if (isUnlocked) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') handlePinKey(e.key);
      else if (e.key === 'Backspace') setPin(p => p.slice(0, -1));
      else if (e.key === 'Escape') setPin('');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handlePinKey, isUnlocked]);

  // ── Data ────────────────────────────────────────────────────────────────────
  const [requests, setRequests] = useState<BorrowRequest[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('pending_approval');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Per-card action states
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});
  const [showRejectInput, setShowRejectInput] = useState<Record<string, boolean>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState<Record<string, string>>({});
  const [actionSuccess, setActionSuccess] = useState<Record<string, string>>({});
  
  // Custom reviewer name
  const [reviewerName, setReviewerName] = useState('Admin');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [reqs, eqs] = await Promise.all([
        getBorrowRequests(config),
        getEquipments(config),
      ]);
      setRequests(reqs);
      setEquipments(eqs);
    } catch (e) {
      console.error('Failed to load approval data:', e);
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => { if (isUnlocked) loadData(); }, [loadData, refreshTrigger, isUnlocked]);

  const setCardLoading = (id: string, val: boolean) => setActionLoading(p => ({ ...p, [id]: val }));
  const setCardError = (id: string, msg: string) => setActionError(p => ({ ...p, [id]: msg }));
  const setCardSuccess = (id: string, msg: string) => setActionSuccess(p => ({ ...p, [id]: msg }));

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleApprove = async (req: BorrowRequest) => {
    setCardLoading(req.id, true);
    setCardError(req.id, '');
    try {
      await updateBorrowRequestStatus(config, req.id, 'approved', { reviewedBy: reviewerName.trim() || 'Admin' });
      setCardSuccess(req.id, '✅ อนุมัติคำขอเรียบร้อยแล้ว');
      await loadData();
      onRefresh();
    } catch (e: any) {
      setCardError(req.id, e?.message || 'ไม่สามารถอนุมัติได้');
    } finally {
      setCardLoading(req.id, false);
    }
  };

  const handleReject = async (req: BorrowRequest) => {
    setCardLoading(req.id, true);
    setCardError(req.id, '');
    try {
      await updateBorrowRequestStatus(config, req.id, 'rejected', {
        adminNote: rejectNote[req.id] || '',
        reviewedBy: reviewerName.trim() || 'Admin',
      });
      setCardSuccess(req.id, '❌ ปฏิเสธคำขอเรียบร้อยแล้ว');
      setShowRejectInput(p => ({ ...p, [req.id]: false }));
      await loadData();
      onRefresh();
    } catch (e: any) {
      setCardError(req.id, e?.message || 'ไม่สามารถปฏิเสธได้');
    } finally {
      setCardLoading(req.id, false);
    }
  };

  // Approved → Borrowing: create real transactions
  const handleDispatch = async (req: BorrowRequest) => {
    setCardLoading(req.id, true);
    setCardError(req.id, '');
    try {
      const txIds: string[] = [];
      for (const item of req.items) {
        const eq = equipments.find(e => e.id === item.equipment_id);
        if (!eq) throw new Error(`ไม่พบอุปกรณ์ ${item.equipment_name} ในระบบ`);
        const tx = await borrowEquipment(config, eq, {
          borrowerName: req.requester_name,
          borrowerDepartment: req.requester_company,
          purpose: req.purpose,
          dueDate: req.requested_due_date,
          borrowQty: item.qty,
          evidenceImageUrl: req.evidence_image_url,
        });
        txIds.push(tx.id);
      }
      await updateBorrowRequestStatus(config, req.id, 'borrowing', {
        transactionIds: txIds,
        reviewedBy: reviewerName.trim() || 'Admin',
      });
      setCardSuccess(req.id, '📦 จ่ายพัสดุออกจากคลังเรียบร้อย — ระบบสร้างประวัติการเบิกแล้ว');
      await loadData();
      onRefresh();
    } catch (e: any) {
      setCardError(req.id, e?.message || 'เกิดข้อผิดพลาดในการจ่ายพัสดุออก');
    } finally {
      setCardLoading(req.id, false);
    }
  };

  const handleMarkReturned = async (req: BorrowRequest) => {
    setCardLoading(req.id, true);
    setCardError(req.id, '');
    try {
      await updateBorrowRequestStatus(config, req.id, 'returned', { reviewedBy: reviewerName.trim() || 'Admin' });
      setCardSuccess(req.id, '🔄 บันทึกการรับคืนพัสดุแล้ว');
      await loadData();
      onRefresh();
    } catch (e: any) {
      setCardError(req.id, e?.message || 'ไม่สามารถบันทึกการคืนได้');
    } finally {
      setCardLoading(req.id, false);
    }
  };

  // ── Filter & Stats ───────────────────────────────────────────────────────────
  const pending = requests.filter(r => r.status === 'pending_approval').length;
  const approved = requests.filter(r => r.status === 'approved').length;
  const borrowing = requests.filter(r => r.status === 'borrowing').length;

  const filtered = filterStatus === 'all' ? requests : requests.filter(r => r.status === filterStatus);

  // ── PIN Gate Screen ──────────────────────────────────────────────────────────
  if (!isUnlocked) {
    const PIN_KEYS = [['1','2','3'],['4','5','6'],['7','8','9'],['','0','⌫']];
    return (
      <div className="max-w-xs mx-auto my-12 bg-white p-8 rounded-3xl border border-[#E8E8ED] shadow-[0_20px_60px_rgba(0,0,0,0.08)] text-center space-y-6">
        <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${pinError ? 'bg-red-50 text-red-500 scale-105' : 'bg-blue-50 text-[#0071E3]'}`}>
          <Lock className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-base font-bold text-[#1D1D1F]">หน้าอนุมัติคำขอ</h2>
          <p className="text-xs text-[#86868B] mt-1">กรุณากรอก PIN ผู้ดูแลระบบ</p>
        </div>
        {/* PIN dots */}
        <div className="flex justify-center gap-3">
          {[0,1,2,3].map(i => (
            <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
              pin.length > i
                ? pinError ? 'bg-red-500 border-red-500' : 'bg-[#0071E3] border-[#0071E3]'
                : 'border-[#C7C7CC]'
            }`} />
          ))}
        </div>
        {pinError && <p className="text-xs text-red-500 font-medium -mt-2">PIN ไม่ถูกต้อง</p>}
        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2">
          {PIN_KEYS.flat().map((key, i) => (
            <button
              key={i}
              type="button"
              onClick={() => key === '⌫' ? setPin(p=>p.slice(0,-1)) : key ? handlePinKey(key) : undefined}
              className={`h-12 rounded-2xl text-base font-bold transition-all active:scale-95 ${
                key
                  ? 'bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#E8E8ED] border border-[#E8E8ED]'
                  : 'pointer-events-none'
              }`}
            >{key}</button>
          ))}
        </div>
      </div>
    );
  }

  // ── Main Admin Panel ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 text-left" id="approval-view-wrapper">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-bold font-sans text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#0071E3]" />
            หน้าอนุมัติคำขอเบิกพัสดุ
          </h2>
          <p className="text-xs text-slate-500 font-sans mt-0.5">ตรวจสอบและอนุมัติ / ปฏิเสธ / จ่ายพัสดุออกจากคลัง</p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-3 py-2 bg-[#F5F5F7] border border-[#E8E8ED] rounded-xl text-xs font-semibold text-[#1D1D1F] hover:bg-[#E8E8ED] transition"
        >
          <RefreshCw className="h-3.5 w-3.5" /> รีเฟรช
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'รอ Approve', count: pending, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
          { label: 'อนุมัติแล้ว (รอจ่าย)', count: approved, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
          { label: 'กำลังยืมอยู่', count: borrowing, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border ${s.border} rounded-2xl p-4 text-center`}>
            <p className={`text-2xl font-extrabold ${s.color}`}>{s.count}</p>
            <p className="text-[10px] text-slate-500 font-semibold mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Reviewer / Approver name input */}
      <div className="bg-white border border-[#E8E8ED] p-4.5 rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left">
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <User className="h-4 w-4 text-[#0071E3]" /> ชื่อผู้ดำเนินการอนุมัติคำขอ (Approver Name)
          </h4>
          <p className="text-[10px] text-slate-450 leading-relaxed font-sans font-semibold">
            ระบุรายชื่อผู้อนุมัติสำหรับลงบันทึกในตารางประวัติและการรับมอบพัสดุ (เช่น สมชาย ใจดี / Admin)
          </p>
        </div>
        <div className="shrink-0">
          <input
            type="text"
            value={reviewerName}
            onChange={(e) => setReviewerName(e.target.value)}
            className="w-full sm:w-56 px-3.5 py-2 border border-[#E8E8ED] rounded-xl text-xs font-bold font-sans focus:outline-hidden focus:border-[#0071E3] bg-[#F5F5F7]/80 focus:bg-white transition-all text-slate-800"
            placeholder="เช่น สมชาย / Admin"
            required
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="bg-[#F5F5F7] p-1 rounded-2xl flex flex-wrap gap-1">
        {([
          ['all', 'ทั้งหมด'],
          ['pending_approval', 'รอ Approve'],
          ['approved', 'อนุมัติแล้ว'],
          ['borrowing', 'กำลังยืม'],
          ['returned', 'คืนแล้ว'],
          ['rejected', 'ปฏิเสธ'],
        ] as [FilterStatus, string][]).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilterStatus(val)}
            className={`flex-1 min-w-fit px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
              filterStatus === val
                ? 'bg-white text-[#0071E3] shadow-sm'
                : 'text-[#86868B] hover:text-[#1D1D1F]'
            }`}
          >{label}{val === 'pending_approval' && pending > 0 ? ` (${pending})` : ''}</button>
        ))}
      </div>

      {/* Request Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-3 border-[#0071E3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <Filter className="h-8 w-8 text-[#C7C7CC]" />
          <p className="text-sm text-[#86868B] font-medium">ไม่มีคำขอในสถานะนี้</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(req => {
            const s = STATUS_LABELS[req.status];
            const isExpanded = expandedId === req.id;
            const isLoading = actionLoading[req.id];
            const err = actionError[req.id];
            const success = actionSuccess[req.id];
            const showReject = showRejectInput[req.id];

            return (
              <div key={req.id} className="bg-white border border-[#E8E8ED] rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] overflow-hidden">
                {/* Card header */}
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : req.id)}
                  className="w-full flex items-start justify-between p-4 text-left gap-3 hover:bg-[#F5F5F7] transition"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-bold ${s.bg} ${s.color}`}>
                        {s.icon} {s.label}
                      </span>
                      <span className="text-[10px] text-[#86868B] font-mono">{req.id}</span>
                    </div>
                    <p className="text-sm font-bold text-[#1D1D1F] truncate">{req.requester_name}</p>
                    <p className="text-xs text-[#86868B]">
                      {req.requester_company}
                      {req.requester_contact ? ` · ${req.requester_contact}` : ''}
                    </p>
                    <div className="flex items-center gap-3 text-[10px] text-[#86868B] flex-wrap">
                      <span className="flex items-center gap-1"><Package className="h-3 w-3" />{req.items.length} ชนิด · {req.items.reduce((s,i)=>s+i.qty,0)} ชิ้น</span>
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />คืน {new Date(req.requested_due_date).toLocaleDateString('th-TH')}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />ยื่น {new Date(req.created_at).toLocaleDateString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-[#86868B] shrink-0 mt-1" /> : <ChevronDown className="h-4 w-4 text-[#86868B] shrink-0 mt-1" />}
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-[#E8E8ED] px-4 pb-4 space-y-4 pt-4">
                    {/* Items list */}
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#86868B] mb-2">รายการพัสดุที่ขอ</p>
                      <div className="space-y-1.5">
                        {req.items.map((item, i) => (
                          <div key={i} className="flex items-center justify-between bg-[#F5F5F7] rounded-xl px-3 py-2">
                            <div>
                              <p className="text-xs font-bold text-[#1D1D1F]">{item.equipment_name}</p>
                              <p className="text-[10px] text-[#86868B] font-mono">{item.equipment_code}</p>
                            </div>
                            <span className="text-xs font-extrabold text-[#0071E3]">{item.qty} ชิ้น</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Purpose */}
                    {req.purpose && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#86868B] mb-1">วัตถุประสงค์</p>
                        <p className="text-xs text-[#1D1D1F] bg-[#F5F5F7] rounded-xl px-3 py-2">{req.purpose}</p>
                      </div>
                    )}

                    {/* Evidence image */}
                    {req.evidence_image_url && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#86868B] mb-2 flex items-center gap-1">
                          <ImageIcon className="h-3 w-3" /> รูปหลักฐาน
                        </p>
                        <img src={req.evidence_image_url} alt="Evidence" className="w-full max-h-48 object-contain rounded-xl border border-[#E8E8ED] cursor-pointer" onClick={() => window.open(req.evidence_image_url, '_blank')} />
                      </div>
                    )}

                    {/* Admin note (if rejected) */}
                    {req.admin_note && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">หมายเหตุ Admin</p>
                        <p className="text-xs text-slate-700">{req.admin_note}</p>
                      </div>
                    )}

                    {/* Feedback */}
                    {success && (
                      <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                        <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                        <p className="text-xs text-emerald-700 font-medium">{success}</p>
                      </div>
                    )}
                    {err && (
                      <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                        <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                        <p className="text-xs text-red-700">{err}</p>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="space-y-2 pt-1">
                      {req.status === 'pending_approval' && (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={() => handleApprove(req)}
                              className="flex items-center justify-center gap-1.5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-all"
                            >
                              {isLoading ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                              อนุมัติ
                            </button>
                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={() => setShowRejectInput(p => ({ ...p, [req.id]: !p[req.id] }))}
                              className="flex items-center justify-center gap-1.5 py-2.5 bg-red-50 hover:bg-red-100 disabled:bg-slate-100 text-red-600 border border-red-200 rounded-xl text-xs font-bold transition-all"
                            >
                              <XCircle className="h-3.5 w-3.5" /> ปฏิเสธ
                            </button>
                          </div>
                          {showReject && (
                            <div className="space-y-2">
                              <textarea
                                rows={2}
                                placeholder="หมายเหตุสำหรับการปฏิเสธ (ไม่บังคับ)..."
                                value={rejectNote[req.id] || ''}
                                onChange={e => setRejectNote(p => ({ ...p, [req.id]: e.target.value }))}
                                className="w-full px-3 py-2 border border-[#E8E8ED] rounded-xl text-xs focus:outline-none focus:border-red-400 resize-none bg-[#F5F5F7]"
                              />
                              <button
                                type="button"
                                disabled={isLoading}
                                onClick={() => handleReject(req)}
                                className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-red-500 hover:bg-red-600 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-all"
                              >
                                {isLoading ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <XOctagon className="h-3.5 w-3.5" />}
                                ยืนยันการปฏิเสธคำขอ
                              </button>
                            </div>
                          )}
                        </>
                      )}

                      {req.status === 'approved' && (
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => handleDispatch(req)}
                          className="w-full flex items-center justify-center gap-1.5 py-3 bg-[#0071E3] hover:bg-[#0077ED] disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-all shadow-[0_4px_16px_rgba(0,113,227,0.25)]"
                        >
                          {isLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Truck className="h-4 w-4" />}
                          ยืนยันจ่ายพัสดุออกจากคลัง — สร้างประวัติเบิกทันที
                        </button>
                      )}

                      {req.status === 'borrowing' && (
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => handleMarkReturned(req)}
                          className="w-full flex items-center justify-center gap-1.5 py-3 bg-slate-700 hover:bg-slate-800 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-all"
                        >
                          {isLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                          บันทึกรับคืนพัสดุ
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
