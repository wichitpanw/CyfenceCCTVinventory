/**
 * การ์ดใบเบิก 1 ใบในหน้าอนุมัติ — สรุปสถานะ + แถบขั้นตอน + ปุ่มดำเนินการตามสถานะ
 */
import React from 'react';
import {
  CheckCircle,
  XCircle,
  Truck,
  RotateCcw,
  Trash2,
  ChevronDown,
  ChevronUp,
  Package,
  Calendar,
  Clock,
  AlertTriangle,
  Image as ImageIcon,
  Minus,
  Plus,
} from 'lucide-react';
import { BorrowRequest, Equipment } from '../../types';
import { statusMeta, REQUEST_STEPS } from '../../lib/statusMeta';
import { formatDate, formatDateTime, dueLabel, isOverdue } from '../../lib/format';

interface RequestCardProps {
  req: BorrowRequest;
  equipments: Equipment[];
  /** จำนวนที่ถูกใบอื่นซึ่งอนุมัติแล้วแต่ยังไม่จ่ายจองไว้ (equipment_id → qty) */
  committedByEquipment: Record<string, number>;
  expanded: boolean;
  busy: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onReject: () => void;
  onDispatch: () => void;
  onReturn: () => void;
  onRevert: () => void;
  onDelete: () => void;
  onEditQty: (equipmentId: string, nextQty: number) => void;
  onViewImage: (url: string) => void;
}

/** จำนวนที่คืนแล้วจริงของรายการ (ใบเก่าที่ยังไม่มี returned_qty ให้ถือว่าคืนครบถ้าใบปิดแล้ว) */
export function returnedQtyOf(item: BorrowRequest['items'][number], req: BorrowRequest): number {
  if (item.returned_qty !== undefined) return item.returned_qty || 0;
  return req.status === 'returned' ? item.qty : 0;
}

export default function RequestCard(props: RequestCardProps) {
  const { req, equipments, committedByEquipment, expanded, busy } = props;
  const meta = statusMeta(req.status);
  const totalQty = req.items.reduce((s, i) => s + i.qty, 0);
  const totalReturned = req.items.reduce((s, i) => s + returnedQtyOf(i, req), 0);
  const overdue = req.status === 'borrowing' && isOverdue(req.requested_due_date);
  const canEditQty = req.status === 'approved';

  return (
    <div
      className={`bg-white border rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.04)] overflow-hidden transition-colors ${
        overdue ? 'border-red-200' : 'border-[#E8E8ED]'
      }`}
    >
      {/* ── หัวการ์ด (กดเพื่อกาง) ── */}
      <button
        type="button"
        onClick={props.onToggle}
        aria-expanded={expanded}
        className="w-full flex items-start justify-between p-4 text-left gap-3 hover:bg-[#F5F5F7] transition cursor-pointer"
      >
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-bold ${meta.className}`}>
              {meta.label}
            </span>
            {overdue && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-red-200 bg-red-50 text-red-700 text-[11px] font-bold">
                <AlertTriangle className="h-3 w-3" /> {dueLabel(req.requested_due_date)}
              </span>
            )}
            <span className="text-[11px] text-[#86868B] font-mono">{req.id}</span>
          </div>

          <p className="text-sm font-bold text-[#1D1D1F] truncate">{req.requester_name}</p>
          <p className="text-xs text-[#6E6E73]">
            {req.requester_company}
            {req.requester_contact ? ` · ${req.requester_contact}` : ''}
          </p>

          <div className="flex items-center gap-3 text-[11px] text-[#6E6E73] flex-wrap">
            <span className="flex items-center gap-1">
              <Package className="h-3 w-3" />
              {req.items.length} ชนิด · {totalQty} ชิ้น
              {totalReturned > 0 && ` (คืนแล้ว ${totalReturned})`}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />คืน {formatDate(req.requested_due_date)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />ยื่น {formatDateTime(req.created_at)}
            </span>
          </div>

          <Stepper status={req.status} />
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-[#86868B] shrink-0 mt-1" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[#86868B] shrink-0 mt-1" />
        )}
      </button>

      {/* ── รายละเอียด ── */}
      {expanded && (
        <div className="border-t border-[#E8E8ED] px-4 pb-4 pt-4 space-y-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#86868B] mb-2">รายการพัสดุที่ขอ</p>
            <div className="space-y-1.5">
              {req.items.map((item, i) => {
                const returned = returnedQtyOf(item, req);
                const remaining = item.qty - returned;
                const done = remaining <= 0;
                const eq = equipments.find(e => e.id === item.equipment_id);
                const available = eq?.available_qty ?? 0;
                const committedElsewhere = Math.max(0, (committedByEquipment[item.equipment_id] || 0) - item.qty);
                const dispatchable = Math.max(0, available - committedElsewhere);

                return (
                  <div
                    key={i}
                    className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 ${
                      done ? 'bg-slate-100' : 'bg-[#F5F5F7]'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className={`text-xs font-bold ${done ? 'text-slate-500 line-through' : 'text-[#1D1D1F]'}`}>
                        {item.equipment_name}
                      </p>
                      <p className="text-[11px] text-[#86868B] font-mono">{item.equipment_code}</p>
                      {canEditQty && (
                        <p className="text-[11px] text-[#6E6E73] mt-0.5">
                          คงเหลือ {available}
                          {committedElsewhere > 0 && ` · ใบอื่นจองไว้ ${committedElsewhere}`}
                          {' · '}
                          <span className={dispatchable < item.qty ? 'text-red-600 font-bold' : 'font-semibold'}>
                            จ่ายได้ {dispatchable}
                          </span>
                        </p>
                      )}
                    </div>

                    {canEditQty ? (
                      <QtyStepper
                        value={item.qty}
                        max={Math.max(1, dispatchable)}
                        disabled={busy}
                        onChange={next => props.onEditQty(item.equipment_id, next)}
                      />
                    ) : (
                      <div className="text-right shrink-0">
                        <p className="text-xs font-extrabold text-[#1D1D1F]">{item.qty} ชิ้น</p>
                        {returned > 0 && (
                          <p className="text-[11px] font-semibold text-[#6E6E73]">
                            คืนแล้ว {returned} · ค้าง {remaining}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {req.purpose && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#86868B] mb-1">วัตถุประสงค์</p>
              <p className="text-xs text-[#1D1D1F] bg-[#F5F5F7] rounded-xl px-3 py-2 leading-relaxed">{req.purpose}</p>
            </div>
          )}

          {req.evidence_image_url && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#86868B] mb-2 flex items-center gap-1">
                <ImageIcon className="h-3 w-3" /> รูปหลักฐาน
              </p>
              <img
                src={req.evidence_image_url}
                alt="หลักฐานการจ่ายพัสดุ"
                loading="lazy"
                decoding="async"
                className="w-full max-h-48 object-contain rounded-xl border border-[#E8E8ED] cursor-pointer bg-white"
                onClick={() => props.onViewImage(req.evidence_image_url!)}
              />
            </div>
          )}

          {req.admin_note && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">หมายเหตุผู้ดูแลระบบ</p>
              <p className="text-xs text-slate-700 leading-relaxed">{req.admin_note}</p>
            </div>
          )}

          {req.reviewed_by && (
            <div className="bg-[#F5F5F7] border border-[#E8E8ED] rounded-xl px-3 py-2.5 space-y-1 text-xs">
              <p className={req.status === 'rejected' ? 'text-red-700' : 'text-emerald-700'}>
                <span className="font-bold text-[#6E6E73]">
                  {req.status === 'rejected' ? 'ผู้ปฏิเสธคำขอ: ' : 'ผู้ดำเนินการ: '}
                </span>
                {req.reviewed_by}
              </p>
              {req.reviewed_at && (
                <p className="text-[11px] text-[#86868B] font-mono">อัปเดตล่าสุด: {formatDateTime(req.reviewed_at)}</p>
              )}
            </div>
          )}

          {/* ── ปุ่มดำเนินการ ── */}
          <div className="flex flex-wrap gap-2 pt-1">
            {req.status === 'pending_approval' && (
              <>
                <ActionButton onClick={props.onApprove} disabled={busy} tone="primary" icon={<CheckCircle className="h-4 w-4" />}>
                  อนุมัติคำขอ
                </ActionButton>
                <ActionButton onClick={props.onReject} disabled={busy} tone="danger-soft" icon={<XCircle className="h-4 w-4" />}>
                  ปฏิเสธ
                </ActionButton>
              </>
            )}

            {req.status === 'approved' && (
              <>
                <ActionButton onClick={props.onDispatch} disabled={busy} tone="primary" icon={<Truck className="h-4 w-4" />}>
                  จ่ายพัสดุออกจากคลัง
                </ActionButton>
                <ActionButton onClick={props.onDelete} disabled={busy} tone="danger-soft" icon={<Trash2 className="h-4 w-4" />}>
                  ลบคำขอ
                </ActionButton>
              </>
            )}

            {req.status === 'borrowing' && (
              <>
                <ActionButton onClick={props.onReturn} disabled={busy} tone="primary" icon={<RotateCcw className="h-4 w-4" />}>
                  บันทึกรับคืนพัสดุ
                </ActionButton>
                {totalReturned > 0 && (
                  <ActionButton onClick={props.onRevert} disabled={busy} tone="danger-soft" icon={<RotateCcw className="h-4 w-4" />}>
                    ยกเลิกการคืน
                  </ActionButton>
                )}
              </>
            )}

            {req.status === 'returned' && (
              <>
                <ActionButton onClick={props.onRevert} disabled={busy} tone="neutral" icon={<RotateCcw className="h-4 w-4" />}>
                  ดึงกลับเป็นกำลังยืม
                </ActionButton>
                <ActionButton onClick={props.onDelete} disabled={busy} tone="danger-soft" icon={<Trash2 className="h-4 w-4" />}>
                  ลบประวัติ
                </ActionButton>
              </>
            )}

            {(req.status === 'rejected' || req.status === 'cancelled') && (
              <ActionButton onClick={props.onDelete} disabled={busy} tone="danger-soft" icon={<Trash2 className="h-4 w-4" />}>
                ลบใบคำขอนี้
              </ActionButton>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */

function Stepper({ status }: { status: BorrowRequest['status'] }) {
  const meta = statusMeta(status);
  if (meta.step < 0) return null;

  return (
    <div className="flex items-center gap-1 pt-1" aria-hidden="true">
      {REQUEST_STEPS.map((label, idx) => {
        const stepNo = idx + 1;
        const reached = meta.step >= stepNo;
        return (
          <React.Fragment key={label}>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                reached ? 'text-[#1D1D1F] bg-[#E8E8ED]' : 'text-[#B0B0B5]'
              }`}
            >
              {label}
            </span>
            {stepNo < REQUEST_STEPS.length && (
              <span className={`h-px w-3 ${meta.step > stepNo ? 'bg-[#1D1D1F]' : 'bg-[#E8E8ED]'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function QtyStepper({
  value,
  max,
  disabled,
  onChange,
}: {
  value: number;
  max: number;
  disabled?: boolean;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= 1}
        className="p-1.5 rounded-lg bg-[#E8E8ED] hover:bg-[#D8D8DC] text-[#1D1D1F] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
        aria-label="ลดจำนวน"
      >
        <Minus className="h-3 w-3" />
      </button>
      <span className="w-10 text-center text-xs font-bold text-[#1D1D1F]">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= max}
        className="p-1.5 rounded-lg bg-[#E8E8ED] hover:bg-[#D8D8DC] text-[#1D1D1F] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
        aria-label="เพิ่มจำนวน"
      >
        <Plus className="h-3 w-3" />
      </button>
      <span className="text-xs text-[#86868B] ml-0.5">ชิ้น</span>
    </div>
  );
}

const TONES = {
  primary: 'bg-[#1D1D1F] hover:bg-black text-white',
  neutral: 'bg-[#F5F5F7] hover:bg-[#E8E8ED] text-[#1D1D1F] border border-[#E8E8ED]',
  'danger-soft': 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200',
};

function ActionButton({
  children,
  icon,
  tone,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  tone: keyof typeof TONES;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 min-w-[150px] flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${TONES[tone]}`}
    >
      {icon}
      {children}
    </button>
  );
}
