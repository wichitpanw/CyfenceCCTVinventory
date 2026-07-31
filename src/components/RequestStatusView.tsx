/**
 * RequestStatusView.tsx — หน้าติดตามสถานะคำขอเบิกสำหรับผู้ใช้ทั่วไป
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Search, User, MapPin, AlertTriangle, PackageCheck } from 'lucide-react';
import { BorrowRequest, SupabaseConfig } from '../types';
import { getBorrowRequests } from '../services/db';
import { statusMeta, REQUEST_STEPS } from '../lib/statusMeta';
import { formatDate, formatDateTime, dueLabel, isOverdue } from '../lib/format';
import { getMyRequestIds } from '../lib/myRequests';
import { useToast } from './ui/Toast';

interface RequestStatusViewProps {
  config: SupabaseConfig;
  refreshTrigger: number;
}

type Scope = 'mine' | 'all';

export default function RequestStatusView({ config, refreshTrigger }: RequestStatusViewProps) {
  const toast = useToast();

  const [requests, setRequests] = useState<BorrowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [myIds, setMyIds] = useState<string[]>([]);

  const [scope, setScope] = useState<Scope>('mine');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dateType, setDateType] = useState<'create' | 'due'>('create');

  useEffect(() => {
    setLoading(true);
    const ids = getMyRequestIds();
    setMyIds(ids);
    // ถ้าเบราว์เซอร์นี้ยังไม่เคยยื่นคำขอ ให้เริ่มที่มุมมองทั้งหมดแทนหน้าว่าง
    if (ids.length === 0) setScope('all');

    getBorrowRequests(config)
      .then(setRequests)
      .catch(e => toast.error(e?.message || 'โหลดข้อมูลคำขอไม่สำเร็จ'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, refreshTrigger]);

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return requests.filter(r => {
      if (scope === 'mine' && !myIds.includes(r.id)) return false;

      if (term) {
        const hit =
          r.id.toLowerCase().includes(term) ||
          r.requester_name.toLowerCase().includes(term) ||
          r.requester_company.toLowerCase().includes(term) ||
          (r.purpose || '').toLowerCase().includes(term);
        if (!hit) return false;
      }

      if (statusFilter !== 'all' && r.status !== statusFilter) return false;

      if (startDate || endDate) {
        const compare = new Date(dateType === 'create' ? r.created_at : r.requested_due_date);
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (compare < start) return false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (compare > end) return false;
        }
      }
      return true;
    });
  }, [requests, scope, myIds, searchTerm, statusFilter, startDate, endDate, dateType]);

  const hasFilters = statusFilter !== 'all' || !!startDate || !!endDate || !!searchTerm;
  const clearFilters = () => {
    setStatusFilter('all');
    setStartDate('');
    setEndDate('');
    setSearchTerm('');
  };

  return (
    <div className="space-y-6 text-left" id="request-status-view-wrapper">
      <div>
        <h2 className="text-sm font-bold text-[#1D1D1F] uppercase tracking-wider flex items-center gap-2">
          <ClipboardList className="h-4 w-4" />
          ติดตามสถานะคำขอ
        </h2>
        <p className="text-xs text-[#6E6E73] mt-0.5">ตรวจสอบว่าคำขอเบิกของคุณอยู่ในขั้นตอนไหนแล้ว</p>
      </div>

      {/* สลับมุมมอง คำขอของฉัน / ทั้งหมด */}
      <div className="bg-[#F5F5F7] p-1 rounded-2xl flex gap-1">
        {([
          ['mine', `คำขอของฉัน${myIds.length ? ` (${myIds.length})` : ''}`],
          ['all', 'คำขอทั้งหมด'],
        ] as [Scope, string][]).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setScope(val)}
            className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
              scope === val ? 'bg-white text-[#1D1D1F] shadow-sm' : 'text-[#6E6E73] hover:text-[#1D1D1F]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ค้นหาและตัวกรอง */}
      <div className="bg-white p-5 rounded-2xl border border-[#E8E8ED] space-y-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-[#86868B] pointer-events-none" />
          <input
            type="text"
            placeholder="ค้นหาด้วยรหัสอ้างอิงคำขอ, ชื่อผู้ยื่น หรือวัตถุประสงค์..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-[#E8E8ED] rounded-xl text-xs bg-[#F5F5F7] focus:bg-white focus:outline-none focus:border-[#1D1D1F] transition"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <FilterField label="สถานะ">
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className={selectCls}
            >
              <option value="all">แสดงทุกสถานะ</option>
              <option value="pending_approval">รอการอนุมัติ</option>
              <option value="approved">อนุมัติแล้ว</option>
              <option value="borrowing">กำลังยืม</option>
              <option value="returned">คืนแล้ว</option>
              <option value="rejected">ปฏิเสธ</option>
            </select>
          </FilterField>

          <FilterField label="ประเภทวันที่">
            <select value={dateType} onChange={e => setDateType(e.target.value as 'create' | 'due')} className={selectCls}>
              <option value="create">วันที่ยื่นคำขอ</option>
              <option value="due">กำหนดส่งคืน</option>
            </select>
          </FilterField>

          <FilterField label="ตั้งแต่วันที่">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={selectCls} />
          </FilterField>

          <FilterField label="ถึงวันที่">
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={selectCls} />
          </FilterField>
        </div>

        {hasFilters && (
          <div className="flex justify-end">
            <button
              onClick={clearFilters}
              className="text-[11px] text-[#6E6E73] hover:text-[#1D1D1F] font-bold underline cursor-pointer"
            >
              ล้างตัวกรองทั้งหมด
            </button>
          </div>
        )}
      </div>

      {/* รายการ */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1].map(i => (
            <div key={i} className="bg-white border border-[#E8E8ED] rounded-2xl p-5 space-y-3 animate-pulse">
              <div className="h-4 w-40 bg-[#F5F5F7] rounded-full" />
              <div className="h-3 w-56 bg-[#F5F5F7] rounded-full" />
              <div className="h-16 bg-[#F5F5F7] rounded-xl" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E8E8ED] p-12 text-center space-y-3">
          <PackageCheck className="h-8 w-8 text-[#C7C7CC] mx-auto" />
          <p className="text-sm text-[#6E6E73] font-medium">
            {scope === 'mine' && myIds.length === 0
              ? 'เบราว์เซอร์นี้ยังไม่เคยยื่นคำขอ — เมื่อยื่นแล้วระบบจะจำรหัสอ้างอิงไว้ให้อัตโนมัติ'
              : 'ไม่พบคำขอที่ตรงกับเงื่อนไขที่ค้นหา'}
          </p>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-[#1D1D1F] text-white rounded-xl text-xs font-semibold hover:bg-black transition cursor-pointer"
            >
              ล้างตัวกรอง
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(req => (
            <RequestStatusCard key={req.id} req={req} isMine={myIds.includes(req.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */

const selectCls =
  'w-full px-3 py-2 border border-[#E8E8ED] rounded-xl text-xs bg-white focus:outline-none focus:border-[#1D1D1F] transition cursor-pointer';

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] text-[#86868B] font-bold uppercase tracking-wider mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function RequestStatusCard({ req, isMine }: { req: BorrowRequest; isMine: boolean }) {
  const meta = statusMeta(req.status);
  const overdue = req.status === 'borrowing' && isOverdue(req.requested_due_date);
  const totalReturned = req.items.reduce((s, i) => s + (i.returned_qty || 0), 0);

  return (
    <div className={`bg-white border rounded-2xl p-5 transition-all ${overdue ? 'border-red-200' : 'border-[#E8E8ED]'}`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-[#E8E8ED] pb-3 mb-3">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-bold ${meta.className}`}>
              {meta.label}
            </span>
            {isMine && (
              <span className="text-[11px] font-bold text-[#1D1D1F] bg-[#F5F5F7] border border-[#E8E8ED] rounded-full px-2 py-0.5">
                คำขอของฉัน
              </span>
            )}
            <span className="text-[11px] font-mono text-[#86868B] bg-[#F5F5F7] border border-[#E8E8ED] rounded-md px-1.5 py-0.5">
              {req.id}
            </span>
          </div>
          <h3 className="text-xs font-black text-[#1D1D1F] flex items-center gap-1.5 pt-0.5">
            <User className="w-3.5 h-3.5" /> {req.requester_name}
            <span className="text-[#86868B] font-semibold">({req.requester_company})</span>
          </h3>
        </div>

        <div className="text-[11px] text-[#86868B] text-left sm:text-right shrink-0 space-y-0.5">
          <p>ยื่นเมื่อ {formatDateTime(req.created_at)}</p>
          <p className={overdue ? 'text-red-600 font-bold' : 'text-[#6E6E73] font-semibold'}>
            กำหนดคืน {formatDate(req.requested_due_date)}
            {req.status === 'borrowing' && ` · ${dueLabel(req.requested_due_date)}`}
          </p>
        </div>
      </div>

      <Timeline status={req.status} />

      {overdue && (
        <div className="flex items-start gap-2 mt-3 p-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <p className="text-[11px] text-red-700 leading-relaxed font-semibold">
            เลยกำหนดคืนแล้ว กรุณาติดต่อเจ้าหน้าที่คลังเพื่อคืนพัสดุหรือขอขยายกำหนด
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
        <div className="space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#86868B]">
            พัสดุที่ขอเบิก ({req.items.length} รายการ)
          </p>
          <div className="space-y-1">
            {req.items.map((item, idx) => {
              const returned = item.returned_qty || 0;
              return (
                <div key={idx} className="flex justify-between items-center bg-[#F5F5F7] rounded-xl px-3 py-1.5 gap-2">
                  <span className="text-xs font-semibold text-[#1D1D1F] truncate">{item.equipment_name}</span>
                  <span className="text-xs font-extrabold text-[#1D1D1F] shrink-0">
                    {item.qty} ชิ้น
                    {returned > 0 && <span className="text-[11px] font-semibold text-emerald-700"> · คืนแล้ว {returned}</span>}
                  </span>
                </div>
              );
            })}
          </div>
          {totalReturned > 0 && req.status === 'borrowing' && (
            <p className="text-[11px] text-[#6E6E73]">คืนแล้วรวม {totalReturned} ชิ้น — ยังมีรายการค้างคืนอยู่</p>
          )}
        </div>

        <div className="space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#86868B] flex items-center gap-1">
            <MapPin className="w-3 h-3" /> วัตถุประสงค์ / สถานที่ปฏิบัติงาน
          </p>
          <div className="bg-[#F5F5F7] rounded-xl p-3 min-h-[56px]">
            <p className="text-xs text-[#1D1D1F] leading-relaxed">
              {req.purpose || <span className="text-[#86868B] italic">ไม่ระบุวัตถุประสงค์</span>}
            </p>
          </div>
          {req.admin_note && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-[11px] font-bold text-amber-800 mb-0.5">หมายเหตุจากเจ้าหน้าที่</p>
              <p className="text-xs text-amber-900 leading-relaxed">{req.admin_note}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Timeline({ status }: { status: BorrowRequest['status'] }) {
  const meta = statusMeta(status);

  if (meta.step < 0) {
    return (
      <div className={`rounded-xl px-3 py-2 text-[11px] font-bold border ${meta.className}`}>
        คำขอนี้{meta.label}แล้ว — ไม่มีการดำเนินการต่อ
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      {REQUEST_STEPS.map((label, idx) => {
        const stepNo = idx + 1;
        const done = meta.step >= stepNo;
        return (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center gap-1 shrink-0">
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  done ? 'bg-[#1D1D1F] text-white' : 'bg-[#E8E8ED] text-[#86868B]'
                }`}
              >
                {stepNo}
              </span>
              <span className={`text-[10px] font-semibold ${done ? 'text-[#1D1D1F]' : 'text-[#A0A0A5]'}`}>{label}</span>
            </div>
            {stepNo < REQUEST_STEPS.length && (
              <span className={`flex-1 h-0.5 rounded-full ${meta.step > stepNo ? 'bg-[#1D1D1F]' : 'bg-[#E8E8ED]'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
