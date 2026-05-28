/**
 * ApprovalView.tsx — Admin Approval Panel
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  Package,
  ChevronDown,
  ChevronUp,
  Calendar,
  AlertCircle,
  RefreshCw,
  Filter,
  CheckCircle2,
  XOctagon,
  Truck,
  RotateCcw,
  Image as ImageIcon,
  ShieldCheck,
  X,
  Camera,
  UploadCloud,
} from 'lucide-react';
import { BorrowRequest, SupabaseConfig, Equipment } from '../types';
import {
  getBorrowRequests,
  updateBorrowRequestStatus,
  borrowEquipment,
  getEquipments,
} from '../services/db';

const compressImage = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (ev) => {
      const img = new Image();
      img.src = ev.target?.result as string;
      img.onload = () => {
        const MAX = 500;
        let { width, height } = img;
        if (width > MAX) { height = (height * MAX) / width; width = MAX; }
        if (height > MAX) { width = (width * MAX) / height; height = MAX; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(ev.target?.result as string); // safe guard fallback
          return;
        }
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });

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

export default function ApprovalView({ config, refreshTrigger, onRefresh }: ApprovalViewProps) {
  // ── Data ────────────────────────────────────────────────────────────────────
  const [requests, setRequests] = useState<BorrowRequest[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [activeLightboxUrl, setActiveLightboxUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('pending_approval');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Per-card action states
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});
  const [showRejectInput, setShowRejectInput] = useState<Record<string, boolean>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState<Record<string, string>>({});
  const [actionSuccess, setActionSuccess] = useState<Record<string, string>>({});

  // Hotfix states for reviewer names and evidence images
  const [approverNames, setApproverNames] = useState<Record<string, string>>({});
  const [showApproveInput, setShowApproveInput] = useState<Record<string, boolean>>({});
  const [dispatchImages, setDispatchImages] = useState<Record<string, string>>({});
  const [dispatchImageMode, setDispatchImageMode] = useState<Record<string, 'upload' | 'url'>>({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [showDispatchInput, setShowDispatchInput] = useState<Record<string, boolean>>({});

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

  useEffect(() => {
    loadData();
  }, [loadData, refreshTrigger]);

  const setCardLoading = (id: string, val: boolean) => setActionLoading(p => ({ ...p, [id]: val }));
  const setCardError = (id: string, msg: string) => setActionError(p => ({ ...p, [id]: msg }));
  const setCardSuccess = (id: string, msg: string) => setActionSuccess(p => ({ ...p, [id]: msg }));

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleApprove = async (req: BorrowRequest, reviewerName: string) => {
    setCardLoading(req.id, true);
    setCardError(req.id, '');
    try {
      await updateBorrowRequestStatus(config, req.id, 'approved', { 
        reviewedBy: reviewerName.trim() || 'Admin' 
      });
      setCardSuccess(req.id, '✅ อนุมัติคำขอเรียบร้อยแล้ว');
      setShowApproveInput(p => ({ ...p, [req.id]: false }));
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
        reviewedBy: 'Admin',
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
  const handleDispatch = async (req: BorrowRequest, evidenceImageUrl: string) => {
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
          evidenceImageUrl: evidenceImageUrl,
        });
        txIds.push(tx.id);
      }
      await updateBorrowRequestStatus(config, req.id, 'borrowing', {
        transactionIds: txIds,
        reviewedBy: 'Admin',
        evidenceImageUrl: evidenceImageUrl,
      });
      setCardSuccess(req.id, '📦 จ่ายพัสดุออกจากคลังเรียบร้อย — ระบบสร้างประวัติการเบิกแล้ว');
      setShowDispatchInput(p => ({ ...p, [req.id]: false }));
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
      await updateBorrowRequestStatus(config, req.id, 'returned', { reviewedBy: 'Admin' });
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

  // ── Main Admin Panel ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 text-left" id="approval-view-wrapper">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-sm font-bold font-sans text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#000000]" />
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
                ? 'bg-white text-[#000000] shadow-sm'
                : 'text-[#86868B] hover:text-[#1D1D1F]'
            }`}
          >{label}{val === 'pending_approval' && pending > 0 ? ` (${pending})` : ''}</button>
        ))}
      </div>

      {/* Request Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-3 border-[#000000] border-t-transparent rounded-full animate-spin" />
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
                            <span className="text-xs font-extrabold text-[#000000]">{item.qty} ชิ้น</span>
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
                        <img src={req.evidence_image_url} alt="Evidence" className="w-full max-h-48 object-contain rounded-xl border border-[#E8E8ED] cursor-pointer" onClick={() => setActiveLightboxUrl(req.evidence_image_url)} />
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
                              onClick={() => {
                                setShowApproveInput(p => ({ ...p, [req.id]: !p[req.id] }));
                                setShowRejectInput(p => ({ ...p, [req.id]: false }));
                              }}
                              className="flex items-center justify-center gap-1.5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                              <CheckCircle className="h-3.5 w-3.5" />
                              {showApproveInput[req.id] ? 'ยกเลิก' : 'อนุมัติ'}
                            </button>
                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={() => {
                                setShowRejectInput(p => ({ ...p, [req.id]: !p[req.id] }));
                                setShowApproveInput(p => ({ ...p, [req.id]: false }));
                              }}
                              className="flex items-center justify-center gap-1.5 py-2.5 bg-red-50 hover:bg-red-100 disabled:bg-slate-100 text-red-600 border border-red-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                              <XCircle className="h-3.5 w-3.5" /> ปฏิเสธ
                            </button>
                          </div>

                          {showApproveInput[req.id] && (
                            <div className="space-y-2 mt-2 bg-[#F5F5F7] p-3.5 rounded-xl border border-[#E8E8ED] animate-in fade-in slide-in-from-top-1 duration-200">
                              <label className="block text-[10px] font-sans font-bold text-[#86868B] uppercase tracking-wider">
                                ชื่อผู้ทำรายการอนุมัติ / ผู้ตรวจสอบ *
                              </label>
                              <input
                                type="text"
                                placeholder="กรอกชื่อผู้ตรวจสอบ เช่น แอดมินวิชัย"
                                value={approverNames[req.id] || ''}
                                onChange={e => setApproverNames(p => ({ ...p, [req.id]: e.target.value }))}
                                className="w-full px-3 py-2 bg-white border border-[#E8E8ED] rounded-xl text-xs font-sans text-black focus:outline-none focus:border-black transition"
                                required
                              />
                              <button
                                type="button"
                                disabled={isLoading || !(approverNames[req.id]?.trim())}
                                onClick={() => handleApprove(req, approverNames[req.id])}
                                className="w-full flex items-center justify-center gap-1.5 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-350 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                              >
                                {isLoading ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                                ยืนยันการอนุมัติคำขอ
                              </button>
                            </div>
                          )}

                          {showReject && (
                            <div className="space-y-2 mt-2">
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
                                className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-red-500 hover:bg-red-600 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                              >
                                {isLoading ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <XOctagon className="h-3.5 w-3.5" />}
                                ยืนยันการปฏิเสธคำขอ
                              </button>
                            </div>
                          )}
                        </>
                      )}

                      {req.status === 'approved' && (
                        <>
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => setShowDispatchInput(p => ({ ...p, [req.id]: !p[req.id] }))}
                            className="w-full flex items-center justify-center gap-1.5 py-3 bg-[#000000] hover:bg-[#1D1D1F] disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition-all shadow-[0_4px_16px_rgba(0,113,227,0.25)] cursor-pointer"
                          >
                            <Truck className="h-4 w-4" />
                            {showDispatchInput[req.id] ? 'ปิดการจ่ายพัสดุ' : 'ดำเนินการจ่ายพัสดุออกจากคลัง'}
                          </button>

                          {showDispatchInput[req.id] && (
                            <div className="space-y-3 mt-2 bg-[#F5F5F7] p-4 rounded-xl border border-[#E8E8ED] animate-in fade-in slide-in-from-top-1 duration-200">
                              <div className="flex items-center justify-between">
                                <label className="block text-[10px] font-sans font-bold text-[#86868B] uppercase tracking-wider">
                                  รูปประกอบหลักฐานการจ่ายพัสดุ *
                                </label>
                                <div className="bg-white p-0.5 rounded-full flex items-center border border-[#E8E8ED] text-[9px] font-bold shadow-3xs">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDispatchImageMode(p => ({ ...p, [req.id]: 'upload' }));
                                      setDispatchImages(p => ({ ...p, [req.id]: '' }));
                                    }}
                                    className={`px-2.5 py-1 rounded-full transition cursor-pointer ${
                                      (dispatchImageMode[req.id] || 'upload') === 'upload'
                                        ? 'bg-black text-white'
                                        : 'text-[#86868B]'
                                    }`}
                                  >
                                    อัปโหลดรูป
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDispatchImageMode(p => ({ ...p, [req.id]: 'url' }));
                                      setDispatchImages(p => ({ ...p, [req.id]: '' }));
                                    }}
                                    className={`px-2.5 py-1 rounded-full transition cursor-pointer ${
                                      dispatchImageMode[req.id] === 'url'
                                        ? 'bg-black text-white'
                                        : 'text-[#86868B]'
                                    }`}
                                  >
                                    แนบลิงก์ URL
                                  </button>
                                </div>
                              </div>

                              {(dispatchImageMode[req.id] || 'upload') === 'upload' ? (
                                dispatchImages[req.id] ? (
                                  <div className="relative w-full">
                                    <img
                                      src={dispatchImages[req.id]}
                                      alt="Handover Evidence"
                                      className="w-full max-h-36 object-contain rounded-lg border border-[#E8E8ED] bg-white p-1"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setDispatchImages(p => ({ ...p, [req.id]: '' }))}
                                      className="absolute top-1.5 right-1.5 w-6 h-6 bg-white border border-[#E8E8ED] rounded-full flex items-center justify-center shadow hover:bg-red-50 transition cursor-pointer"
                                    >
                                      <X className="h-3 w-3 text-red-500" />
                                    </button>
                                  </div>
                                ) : (
                                  <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-[#C5C5C7] rounded-xl p-6 cursor-pointer hover:bg-white hover:border-black transition">
                                    <UploadCloud className="h-6 w-6 text-[#86868B]" />
                                    <span className="text-[11px] font-semibold text-[#86868B]">คลิกเพื่ออัปโหลด/เลือกรูปภาพหลักฐาน</span>
                                    <span className="text-[9px] text-[#86868B]">PNG, JPG, WebP (ย่อรูปภาพให้อัตโนมัติ)</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={async e => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        try {
                                          setUploadErrors(p => ({ ...p, [req.id]: '' }));
                                          const compressed = await compressImage(file);
                                          setDispatchImages(p => ({ ...p, [req.id]: compressed }));
                                        } catch {
                                          setUploadErrors(p => ({ ...p, [req.id]: 'เกิดข้อผิดพลาดในการประมวลผลรูปภาพ' }));
                                        }
                                      }}
                                      className="hidden"
                                    />
                                  </label>
                                )
                              ) : (
                                <input
                                  type="url"
                                  value={dispatchImages[req.id] || ''}
                                  onChange={e => setDispatchImages(p => ({ ...p, [req.id]: e.target.value }))}
                                  placeholder="https://... URL รูปภาพหลักฐานเซ็นรับของ"
                                  className="w-full px-3 py-2 border border-[#E8E8ED] rounded-xl text-xs focus:outline-none focus:border-black bg-white transition"
                                />
                              )}

                              {uploadErrors[req.id] && (
                                <p className="text-[10px] text-red-650 font-semibold">{uploadErrors[req.id]}</p>
                              )}

                              <button
                                type="button"
                                disabled={isLoading || !dispatchImages[req.id]}
                                onClick={() => handleDispatch(req, dispatchImages[req.id])}
                                className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-black hover:bg-[#1D1D1F] disabled:bg-slate-350 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                              >
                                {isLoading ? (
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Truck className="h-4 w-4" />
                                )}
                                ยืนยันการจ่ายพัสดุและแนบหลักฐาน
                              </button>
                            </div>
                          )}
                        </>
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

      {/* Lightbox Modal for Evidence Images */}
      {activeLightboxUrl && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1D1D1F]/80 backdrop-blur-md transition-opacity duration-300 animate-fade-in"
          onClick={() => setActiveLightboxUrl(null)}
        >
          <div 
            className="relative max-w-4xl max-h-[90vh] p-4 bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col items-center justify-center animate-in zoom-in-95 duration-250 border border-[#E8E8ED]" 
            onClick={e => e.stopPropagation()}
          >
            <button 
              type="button"
              className="absolute top-4 right-4 p-2 bg-[#1D1D1F]/10 hover:bg-[#1D1D1F]/20 text-[#1D1D1F] rounded-full transition-all cursor-pointer z-10" 
              onClick={() => setActiveLightboxUrl(null)}
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-full overflow-auto flex items-center justify-center p-2">
              <img 
                src={activeLightboxUrl} 
                alt="Evidence" 
                className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-sm" 
              />
            </div>
            <div className="mt-4 text-xs font-semibold text-[#86868B] font-sans flex items-center gap-2 pb-2">
              <ImageIcon className="w-4 h-4 text-blue-650" />
              <span>ภาพหลักฐานใบเบิกคลังอุปกรณ์ (Cyfence Inventory Evidence Image)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
