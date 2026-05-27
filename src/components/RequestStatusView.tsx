/**
 * RequestStatusView.tsx — หน้าตรวจสอบสถานะคำขอยื่นเบิกสำหรับผู้ใช้ทั่วไป
 */
import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  Truck,
  RotateCcw,
  Calendar,
  User,
  Briefcase,
  AlertCircle,
  FileText,
  MapPin,
} from 'lucide-react';
import { BorrowRequest, SupabaseConfig } from '../types';
import { getBorrowRequests } from '../services/db';

interface RequestStatusViewProps {
  config: SupabaseConfig;
  refreshTrigger: number;
}

const STATUS_LABELS: Record<BorrowRequest['status'], { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending_approval: { label: 'รอการอนุมัติ', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-250', icon: <Clock className="h-3.5 w-3.5" /> },
  approved: { label: 'อนุมัติแล้ว (รอจ่ายพัสดุ)', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-250', icon: <CheckCircle className="h-3.5 w-3.5" /> },
  rejected: { label: 'ปฏิเสธการขอเบิก', color: 'text-red-700', bg: 'bg-red-50 border-red-250', icon: <XCircle className="h-3.5 w-3.5" /> },
  borrowing: { label: 'กำลังเบิกใช้งานอยู่', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-250', icon: <Truck className="h-3.5 w-3.5" /> },
  returned: { label: 'ส่งมอบคืนคลังแล้ว', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-255', icon: <CheckCircle className="h-3.5 w-3.5" /> },
  cancelled: { label: 'ยกเลิกคำขอ', color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200', icon: <XCircle className="h-3.5 w-3.5" /> },
};

export default function RequestStatusView({ config, refreshTrigger }: RequestStatusViewProps) {
  const [requests, setRequests] = useState<BorrowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setLoading(true);
    getBorrowRequests(config)
      .then(setRequests)
      .finally(() => setLoading(false));
  }, [config, refreshTrigger]);

  const filtered = requests.filter(r => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.id.toLowerCase().includes(term) ||
      r.requester_name.toLowerCase().includes(term) ||
      r.requester_company.toLowerCase().includes(term) ||
      (r.purpose && r.purpose.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6 text-left" id="request-status-view-wrapper">
      <div>
        <h2 className="text-sm font-bold font-sans text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-[#0071E3]" />
          รายการรอยืนยัน
        </h2>
        <p className="text-xs text-slate-500 font-sans mt-0.5">
          ตรวจสอบสถานะคำขอเบิกพัสดุและสถานที่/งานระบบที่ขอเบิกใช้งานอุปกรณ์จริง
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          placeholder="ค้นหาด้วยรหัสคำขอ, ชื่อผู้ยื่น หรือวัตถุประสงค์สถานที่..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-[#E8E8ED] rounded-2xl text-xs font-sans focus:outline-hidden focus:border-[#0071E3] bg-white transition-all shadow-[0_4px_16px_rgba(0,0,0,0.02)]"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-[#0071E3] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E8E8ED] p-12 text-center text-slate-400 font-semibold text-xs">
          ไม่พบรายการคำขอรอยืนยันที่ค้นหาในระบบ
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(req => {
            const status = STATUS_LABELS[req.status] || { label: req.status, color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200', icon: null };
            return (
              <div key={req.id} className="bg-white border border-[#E8E8ED] rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_6px_24px_rgba(0,0,0,0.05)] transition-all">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-[#E8E8ED] pb-3 mb-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold ${status.bg} ${status.color}`}>
                        {status.icon}
                        {status.label}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 font-bold bg-slate-50 border border-slate-100 rounded-md px-1.5 py-0.5">{req.id}</span>
                    </div>
                    <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5 pt-1.5">
                      <User className="w-3.5 h-3.5 text-[#0071E3]" /> {req.requester_name}
                      <span className="text-slate-400 font-semibold font-sans">({req.requester_company})</span>
                    </h3>
                  </div>

                  <div className="text-[10px] text-slate-400 text-left sm:text-right font-sans shrink-0 font-medium">
                    <p>ยื่นเมื่อ: {new Date(req.created_at).toLocaleDateString('th-TH', { hour: '2-digit', minute: '2-digit' })}</p>
                    <p className="mt-0.5 text-slate-500 font-semibold">กำหนดคืน: {new Date(req.requested_due_date).toLocaleDateString('th-TH')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Items detail list */}
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">อุปกรณ์ที่เสนอขอเบิก ({req.items.length} รายการ)</p>
                    <div className="space-y-1">
                      {req.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-[#F5F5F7]/80 rounded-xl px-3 py-1.5 border border-slate-50">
                          <span className="text-xs font-semibold text-slate-700 truncate max-w-[220px]">{item.equipment_name}</span>
                          <span className="text-xs font-extrabold text-[#0071E3] shrink-0">{item.qty} ชิ้น</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Objective & Site details */}
                  <div className="space-y-1.5 text-left">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#0071E3]" /> วัตถุประสงค์สถานที่ขอไป / รายละเอียดงาน
                    </p>
                    <div className="bg-[#F5F5F7]/80 rounded-xl p-3 border border-slate-50 min-h-[56px]">
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {req.purpose ? req.purpose : <span className="text-slate-400 italic">ไม่ระบุวัตถุประสงค์ที่ชัดเจน</span>}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
