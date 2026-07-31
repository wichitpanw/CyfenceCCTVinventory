/**
 * โมดัลจ่ายพัสดุออกจากคลัง — แนบหลักฐาน + แสดงสรุปยอดที่จะถูกตัดก่อนยืนยัน
 */
import React, { useEffect, useState } from 'react';
import { Truck, UploadCloud, X, AlertTriangle } from 'lucide-react';
import Modal from '../ui/Modal';
import { BorrowRequest, Equipment } from '../../types';
import { compressImage } from '../../lib/image';

interface Props {
  open: boolean;
  req: BorrowRequest | null;
  equipments: Equipment[];
  busy: boolean;
  onClose: () => void;
  onConfirm: (payload: { evidenceImageUrl: string; dispatchedBy: string }) => void;
}

const DISPATCHER_KEY = 'cyfence_last_dispatcher';

export default function DispatchDialog({ open, req, equipments, busy, onClose, onConfirm }: Props) {
  const [image, setImage] = useState('');
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [dispatcher, setDispatcher] = useState('');
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    if (open) {
      setImage('');
      setMode('upload');
      setUploadError('');
      setDispatcher(localStorage.getItem(DISPATCHER_KEY) || '');
    }
  }, [open, req?.id]);

  if (!req) return null;

  // ตรวจสต็อกฝั่งหน้าจอเพื่อเตือนล่วงหน้า — ตัวจริงถูกตรวจซ้ำที่ server ก่อนเขียนอยู่แล้ว
  const shortages = req.items
    .map(item => {
      const eq = equipments.find(e => e.id === item.equipment_id);
      const available = eq?.available_qty ?? 0;
      return available < item.qty ? { name: item.equipment_name, need: item.qty, available } : null;
    })
    .filter(Boolean) as { name: string; need: number; available: number }[];

  const canSubmit = !!image && dispatcher.trim().length > 0 && !busy;

  const submit = () => {
    if (!canSubmit) return;
    localStorage.setItem(DISPATCHER_KEY, dispatcher.trim());
    onConfirm({ evidenceImageUrl: image, dispatchedBy: dispatcher.trim() });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="จ่ายพัสดุออกจากคลัง"
      subtitle={`${req.requester_name} · ${req.requester_company}`}
      icon={<Truck className="h-5 w-5 text-[#1D1D1F]" />}
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
            className="py-3 px-4 bg-[#1D1D1F] hover:bg-black text-white font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            {busy ? (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Truck className="h-4 w-4" />
            )}
            ยืนยันจ่ายพัสดุและตัดสต็อก
          </button>
        </div>
      }
    >
      {/* สรุปยอดที่จะถูกตัด */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#86868B] mb-2">รายการที่จะตัดออกจากคลัง</p>
        <div className="space-y-1.5">
          {req.items.map((item, i) => {
            const eq = equipments.find(e => e.id === item.equipment_id);
            const available = eq?.available_qty ?? 0;
            const short = available < item.qty;
            return (
              <div
                key={i}
                className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 border ${
                  short ? 'bg-red-50 border-red-200' : 'bg-[#F5F5F7] border-transparent'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#1D1D1F] truncate">{item.equipment_name}</p>
                  <p className="text-[11px] text-[#86868B] font-mono">{item.equipment_code}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-extrabold text-[#1D1D1F]">−{item.qty} ชิ้น</p>
                  <p className={`text-[11px] font-semibold ${short ? 'text-red-600' : 'text-[#6E6E73]'}`}>
                    คงเหลือ {available} → {Math.max(0, available - item.qty)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {shortages.length > 0 && (
        <div className="flex gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-2xl">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <p className="font-bold text-red-800">สต็อกไม่พอสำหรับบางรายการ</p>
            <p className="text-red-700 leading-relaxed">
              กรุณาแก้จำนวนในใบเบิก หรือเติมสต็อกก่อน — ระบบจะไม่ยอมจ่ายพัสดุจนกว่ายอดจะพอทุกรายการ
            </p>
          </div>
        </div>
      )}

      {/* ผู้จ่ายพัสดุ */}
      <div className="space-y-1.5">
        <label className="block text-[11px] font-bold text-[#86868B] uppercase tracking-wider">ชื่อผู้จ่ายพัสดุ *</label>
        <input
          type="text"
          value={dispatcher}
          onChange={e => setDispatcher(e.target.value)}
          placeholder="เช่น แอดมินวิชัย"
          className="w-full px-3 py-2.5 bg-white border border-[#E8E8ED] rounded-xl text-xs focus:outline-none focus:border-[#1D1D1F] transition"
        />
      </div>

      {/* หลักฐาน */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <label className="text-[11px] font-bold text-[#86868B] uppercase tracking-wider">รูปหลักฐานการส่งมอบ *</label>
          <div className="bg-[#F5F5F7] p-0.5 rounded-full flex items-center border border-[#E8E8ED] text-[11px] font-bold">
            {(['upload', 'url'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setImage('');
                  setUploadError('');
                }}
                className={`px-3 py-1 rounded-full transition cursor-pointer ${
                  mode === m ? 'bg-[#1D1D1F] text-white' : 'text-[#6E6E73]'
                }`}
              >
                {m === 'upload' ? 'อัปโหลดรูป' : 'แนบลิงก์'}
              </button>
            ))}
          </div>
        </div>

        {mode === 'upload' ? (
          image ? (
            <div className="relative">
              <img
                src={image}
                alt="หลักฐานการส่งมอบ"
                className="w-full max-h-48 object-contain rounded-xl border border-[#E8E8ED] bg-white p-1"
              />
              <button
                type="button"
                onClick={() => setImage('')}
                className="absolute top-2 right-2 w-7 h-7 bg-white border border-[#E8E8ED] rounded-full flex items-center justify-center shadow hover:bg-red-50 transition cursor-pointer"
                aria-label="ลบรูป"
              >
                <X className="h-3.5 w-3.5 text-red-600" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-[#C7C7CC] rounded-xl p-6 cursor-pointer hover:bg-[#F5F5F7] hover:border-[#1D1D1F] transition">
              <UploadCloud className="h-6 w-6 text-[#86868B]" />
              <span className="text-xs font-semibold text-[#6E6E73]">คลิกเพื่อเลือกรูปภาพหลักฐาน</span>
              <span className="text-[11px] text-[#86868B]">PNG, JPG, WebP — ระบบย่อขนาดให้อัตโนมัติ</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    setUploadError('');
                    setImage(await compressImage(file));
                  } catch (err: any) {
                    setUploadError(err?.message || 'ประมวลผลรูปภาพไม่สำเร็จ');
                  }
                }}
              />
            </label>
          )
        ) : (
          <input
            type="url"
            value={image}
            onChange={e => setImage(e.target.value)}
            placeholder="https://... ลิงก์รูปหลักฐาน"
            className="w-full px-3 py-2.5 bg-white border border-[#E8E8ED] rounded-xl text-xs focus:outline-none focus:border-[#1D1D1F] transition"
          />
        )}

        {uploadError && <p className="text-[11px] text-red-600 font-semibold">{uploadError}</p>}
      </div>
    </Modal>
  );
}
