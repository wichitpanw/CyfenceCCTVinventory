/**
 * โมดัลบันทึกรับคืนพัสดุ — เลือกรายการ/จำนวน/สภาพรายชิ้น พร้อมปุ่มลัด "คืนครบทุกรายการ"
 */
import React, { useEffect, useMemo, useState } from 'react';
import { RotateCcw, CheckSquare, Square, Minus, Plus } from 'lucide-react';
import Modal from '../ui/Modal';
import { BorrowRequest, EquipmentCondition, ReturnItemInput } from '../../types';
import { CONDITION_LABELS } from '../../lib/statusMeta';
import { returnedQtyOf } from './RequestCard';

interface Props {
  open: boolean;
  req: BorrowRequest | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (payload: { items: ReturnItemInput[]; returnerName: string }) => void;
}

interface RowState {
  selected: boolean;
  qty: number;
  condition: EquipmentCondition;
  note: string;
}

const RETURNER_KEY = 'cyfence_last_returner';
const DEFAULT_NOTE = 'ปกติ เรียบร้อยดี';

export default function ReturnDialog({ open, req, busy, onClose, onConfirm }: Props) {
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [returner, setReturner] = useState('');

  // รายการที่ยังค้างคืนอยู่
  const pendingItems = useMemo(
    () => (req ? req.items.filter(i => i.qty - returnedQtyOf(i, req) > 0) : []),
    [req]
  );

  useEffect(() => {
    if (!open || !req) return;
    const next: Record<string, RowState> = {};
    for (const item of req.items) {
      const remaining = item.qty - returnedQtyOf(item, req);
      if (remaining > 0) {
        next[item.equipment_id] = { selected: true, qty: remaining, condition: 'available', note: DEFAULT_NOTE };
      }
    }
    setRows(next);
    setReturner(localStorage.getItem(RETURNER_KEY) || '');
  }, [open, req]);

  if (!req) return null;

  const patch = (id: string, changes: Partial<RowState>) =>
    setRows(prev => ({ ...prev, [id]: { ...prev[id], ...changes } }));

  const selectedItems: ReturnItemInput[] = Object.entries(rows)
    .filter(([, r]) => r.selected && r.qty > 0)
    .map(([equipment_id, r]) => ({
      equipment_id,
      qty: r.qty,
      conditionStatus: r.condition,
      conditionNote: r.note.trim() || DEFAULT_NOTE,
    }));

  const totalReturning = selectedItems.reduce((s, i) => s + i.qty, 0);
  const canSubmit = selectedItems.length > 0 && returner.trim().length > 0 && !busy;

  const submit = () => {
    if (!canSubmit) return;
    localStorage.setItem(RETURNER_KEY, returner.trim());
    onConfirm({ items: selectedItems, returnerName: returner.trim() });
  };

  const selectAllFull = () => {
    setRows(prev => {
      const next = { ...prev };
      for (const item of pendingItems) {
        const remaining = item.qty - returnedQtyOf(item, req);
        next[item.equipment_id] = { ...next[item.equipment_id], selected: true, qty: remaining };
      }
      return next;
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="บันทึกรับคืนพัสดุ"
      subtitle={`${req.requester_name} · ${req.requester_company}`}
      icon={<RotateCcw className="h-5 w-5 text-[#1D1D1F]" />}
      footer={
        <div className="space-y-2.5">
          <p className="text-[11px] text-[#6E6E73] text-center">
            กำลังจะรับคืน <b className="text-[#1D1D1F]">{totalReturning} ชิ้น</b> จาก {selectedItems.length} รายการ
          </p>
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
              className="py-3 px-4 bg-[#1D1D1F] hover:bg-black text-white font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              {busy ? (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              ยืนยันการรับคืน
            </button>
          </div>
        </div>
      }
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#86868B]">ระบุจำนวนและสภาพพัสดุที่รับคืน</p>
        <button
          type="button"
          onClick={selectAllFull}
          className="text-[11px] font-bold text-[#1D1D1F] bg-[#F5F5F7] border border-[#E8E8ED] hover:bg-[#E8E8ED] px-3 py-1.5 rounded-full transition cursor-pointer"
        >
          เลือกคืนครบทุกรายการ
        </button>
      </div>

      <div className="space-y-2">
        {req.items.map(item => {
          const remaining = item.qty - returnedQtyOf(item, req);

          if (remaining <= 0) {
            return (
              <div
                key={item.equipment_id}
                className="flex items-center justify-between bg-[#F5F5F7]/60 rounded-xl px-3 py-2 border border-dashed border-[#E8E8ED]"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#86868B] line-through truncate">{item.equipment_name}</p>
                  <p className="text-[11px] text-[#86868B] font-mono">{item.equipment_code}</p>
                </div>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                  คืนครบแล้ว
                </span>
              </div>
            );
          }

          const row = rows[item.equipment_id];
          if (!row) return null;

          return (
            <div
              key={item.equipment_id}
              className={`bg-white p-3 rounded-xl border space-y-3 transition ${
                row.selected ? 'border-[#E8E8ED]' : 'border-[#E8E8ED] opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => patch(item.equipment_id, { selected: !row.selected })}
                  className="flex items-start gap-2 text-left cursor-pointer min-w-0"
                >
                  {row.selected ? (
                    <CheckSquare className="h-4 w-4 text-[#1D1D1F] shrink-0 mt-0.5" />
                  ) : (
                    <Square className="h-4 w-4 text-[#86868B] shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p className={`text-xs font-bold ${row.selected ? 'text-[#1D1D1F]' : 'text-[#86868B] line-through'}`}>
                      {item.equipment_name}
                    </p>
                    <p className="text-[11px] text-[#86868B] font-mono">{item.equipment_code}</p>
                  </div>
                </button>
                <span className="text-[11px] font-bold text-[#6E6E73] bg-[#F5F5F7] px-2 py-0.5 rounded-full shrink-0">
                  ค้างยืม {remaining} ชิ้น
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#86868B] block">จำนวนที่คืน</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!row.selected || row.qty <= 1}
                      onClick={() => patch(item.equipment_id, { qty: Math.max(1, row.qty - 1) })}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#F5F5F7] border border-[#E8E8ED] hover:bg-[#E8E8ED] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                      aria-label="ลดจำนวน"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-8 text-center text-xs font-bold text-[#1D1D1F]">{row.selected ? row.qty : 0}</span>
                    <button
                      type="button"
                      disabled={!row.selected || row.qty >= remaining}
                      onClick={() => patch(item.equipment_id, { qty: Math.min(remaining, row.qty + 1) })}
                      className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#F5F5F7] border border-[#E8E8ED] hover:bg-[#E8E8ED] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                      aria-label="เพิ่มจำนวน"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#86868B] block">สภาพหลังคืน</label>
                  <select
                    disabled={!row.selected}
                    value={row.condition}
                    onChange={e => patch(item.equipment_id, { condition: e.target.value as EquipmentCondition })}
                    className="w-full px-2 py-1.5 bg-[#F5F5F7] border border-[#E8E8ED] rounded-lg text-xs focus:outline-none focus:border-[#1D1D1F] transition disabled:opacity-50 cursor-pointer"
                  >
                    {(Object.keys(CONDITION_LABELS) as EquipmentCondition[]).map(c => (
                      <option key={c} value={c}>
                        {CONDITION_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#86868B] block">หมายเหตุ</label>
                  <input
                    type="text"
                    disabled={!row.selected}
                    value={row.note}
                    onChange={e => patch(item.equipment_id, { note: e.target.value })}
                    className="w-full px-2 py-1.5 bg-[#F5F5F7] border border-[#E8E8ED] rounded-lg text-xs focus:outline-none focus:border-[#1D1D1F] transition disabled:opacity-50"
                  />
                </div>
              </div>

              {row.selected && row.condition !== 'available' && (
                <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                  พัสดุจำนวน {row.qty} ชิ้นนี้จะถูกนับเข้าช่อง "{CONDITION_LABELS[row.condition]}" ไม่ใช่ของว่างพร้อมใช้
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="space-y-1.5">
        <label className="block text-[11px] font-bold text-[#86868B] uppercase tracking-wider">ชื่อผู้รับคืน *</label>
        <input
          type="text"
          value={returner}
          onChange={e => setReturner(e.target.value)}
          placeholder="เช่น แอดมินวิชัย"
          className="w-full px-3 py-2.5 bg-white border border-[#E8E8ED] rounded-xl text-xs focus:outline-none focus:border-[#1D1D1F] transition"
        />
      </div>
    </Modal>
  );
}
