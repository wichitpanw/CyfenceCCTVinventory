/**
 * RequestView.tsx — หน้ายื่นคำขอเบิกพัสดุ (สาธารณะ ไม่ต้อง Login)
 */
import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  User,
  Briefcase,
  Phone,
  Calendar,
  FileText,
  Search,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  Package,
  Send,
  Camera,
  UploadCloud,
  X,
  ClipboardList,
} from 'lucide-react';
import { Equipment, BorrowRequestItem, SupabaseConfig } from '../types';
import { getEquipments, createBorrowRequest } from '../services/db';

interface RequestViewProps {
  config: SupabaseConfig;
  refreshTrigger: number;
}

const COMPANIES = ['IQsafe', 'Insider', 'อื่นๆ ระบุ'];

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

export default function RequestView({ config, refreshTrigger }: RequestViewProps) {
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);

  // Cart
  const [cart, setCart] = useState<{ equipment: Equipment; qty: number }[]>([]);
  const [selectedEqId, setSelectedEqId] = useState('');
  const [borrowQty, setBorrowQty] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Requester info
  const [requesterName, setRequesterName] = useState('');
  const [requesterCompany, setRequesterCompany] = useState(COMPANIES[0]);
  const [customCompany, setCustomCompany] = useState('');
  const [requesterContact, setRequesterContact] = useState('');

  // Purpose & Date
  const [purpose, setPurpose] = useState('');
  const [dueDate, setDueDate] = useState('');

  // Submission
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [successRefCode, setSuccessRefCode] = useState('');

  // Pre-set default due date (7 days)
  useEffect(() => {
    const d = new Date(); d.setDate(d.getDate() + 7);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setDueDate(`${yyyy}-${mm}-${dd}`);
  }, []);

  useEffect(() => {
    getEquipments(config)
      .then(setEquipments)
      .finally(() => setLoading(false));
  }, [config, refreshTrigger]);

  // categories
  const categories = Array.from(new Set(equipments.map(e => e.category))).sort();

  const filteredEq = equipments.filter(e => {
    const avail = (e.available_qty ?? 0) > 0;
    const matchCat = !selectedCategory || e.category === selectedCategory;
    const matchSearch = !searchTerm ||
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.code.toLowerCase().includes(searchTerm.toLowerCase());
    return avail && matchCat && matchSearch;
  });

  const removeFromCart = (idx: number) => {
    const n = [...cart]; n.splice(idx, 1); setCart(n);
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (cart.length === 0) { setSubmitError('กรุณาเลือกอุปกรณ์ที่ต้องการขอเบิกอย่างน้อย 1 รายการ'); return; }
    if (!requesterName.trim()) { setSubmitError('กรุณาระบุชื่อ-นามสกุลผู้ยื่นคำขอ'); return; }
    if (!dueDate) { setSubmitError('กรุณาระบุวันที่ต้องการคืนพัสดุ'); return; }

    const finalCompany = requesterCompany === 'อื่นๆ ระบุ'
      ? customCompany.trim()
      : requesterCompany;
    if (!finalCompany) { setSubmitError('กรุณาระบุชื่อบริษัท'); return; }

    const items: BorrowRequestItem[] = cart.map(c => ({
      equipment_id: c.equipment.id,
      equipment_code: c.equipment.code,
      equipment_name: c.equipment.name,
      qty: c.qty,
    }));

    setSubmitting(true);
    try {
      const result = await createBorrowRequest(config, {
        requester_name: requesterName.trim(),
        requester_company: finalCompany,
        requester_contact: requesterContact.trim() || undefined,
        items,
        purpose: purpose.trim(),
        requested_due_date: dueDate,
      });
      setSuccessRefCode(result.id);

      // Async Telegram Notification trigger
      const triggerTelegramNotification = async () => {
        try {
          const { getSystemSettings, sendTelegramNotification } = await import('../services/db');
          const settings = await getSystemSettings(config);
          const token = settings?.telegram_bot_token || localStorage.getItem('system_telegram_bot_token');
          const chatId = settings?.telegram_chat_id || localStorage.getItem('system_telegram_chat_id');
          
          if (token && chatId) {
            // Format Items list for message
            const itemsStr = cart.map(c => `• <b>${c.equipment.name}</b> (${c.equipment.code}) — <code>${c.qty}</code> ชิ้น`).join('\n');
            
            const message = 
              `<b>🔔 มีคำขอเสนอเบิกพัสดุใหม่เข้ามาในระบบ!</b>\n\n` +
              `👤 <b>ผู้ยื่นคำขอ:</b> ${requesterName.trim()}\n` +
              `🏢 <b>บริษัท/สังกัด:</b> ${finalCompany}\n` +
              `📞 <b>เบอร์ติดต่อ:</b> ${requesterContact.trim() || 'ไม่ระบุ'}\n\n` +
              `📦 <b>รายการพัสดุที่ขอเบิก:</b>\n${itemsStr}\n\n` +
              `📝 <b>วัตถุประสงค์สถานที่ขอไป:</b>\n${purpose.trim() || 'ไม่ระบุ'}\n\n` +
              `📅 <b>กำหนดคืนพัสดุ:</b> ${new Date(dueDate).toLocaleDateString('th-TH')}\n` +
              `🏷️ <b>รหัสอ้างอิงคำขอ:</b> <code>${result.id}</code>`;

            await sendTelegramNotification(token, chatId, message);
          }
        } catch (teleErr) {
          console.warn('Failed to send auto Telegram request notice:', teleErr);
        }
      };
      triggerTelegramNotification();

    } catch (err: any) {
      setSubmitError(err?.message || 'ส่งคำขอไม่สำเร็จ โปรดลองใหม่อีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSuccessRefCode('');
    setCart([]);
    setRequesterName('');
    setRequesterCompany(COMPANIES[0]);
    setCustomCompany('');
    setRequesterContact('');
    setPurpose('');
    setSubmitError('');
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (successRefCode) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 py-12 px-4">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-emerald-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-[#1D1D1F]">ส่งคำขอเบิกพัสดุเรียบร้อยแล้ว!</h2>
          <p className="text-sm text-[#86868B]">ผู้ดูแลระบบจะตรวจสอบและแจ้งผลให้ทราบภายในเร็วๆ นี้</p>
        </div>
        <div className="bg-[#F5F5F7] border border-[#E8E8ED] rounded-2xl p-6 w-full max-w-sm space-y-2">
          <p className="text-[11px] text-[#86868B] uppercase tracking-wider font-semibold">รหัสอ้างอิงคำขอของคุณ</p>
          <p className="text-base font-mono font-bold text-[#000000] break-all">{successRefCode}</p>
          <p className="text-[10px] text-[#86868B]">กรุณาบันทึกรหัสนี้ไว้สำหรับติดตามสถานะคำขอ</p>
        </div>
        <button
          onClick={handleReset}
          className="px-8 py-3 bg-[#000000] text-white rounded-xl text-sm font-semibold hover:bg-[#1D1D1F] transition-all"
        >
          ยื่นคำขอใหม่
        </button>
      </div>
    );
  }

  // ── Main form ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 text-left" id="request-view-wrapper">
      {/* Header */}
      <div>
        <h2 className="text-sm font-bold font-sans text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-[#000000]" />
          ยื่นคำขอเบิกพัสดุ
        </h2>
        <p className="text-xs text-slate-500 font-sans mt-0.5">
          กรอกรายละเอียดพัสดุที่ต้องการและข้อมูลผู้ขอ — เจ้าหน้าที่จะดำเนินการอนุมัติภายในเร็วๆ นี้
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* ── Step 1: Cart ── */}
        <div className="bg-white border border-[#E8E8ED] rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] space-y-4">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#1D1D1F] flex items-center gap-2">
            <ShoppingCart className="h-3.5 w-3.5 text-[#000000]" />
            1. รายการพัสดุที่ต้องการขอเบิก
          </h3>

          {/* Cart items */}
          {cart.length > 0 && (
            <div className="space-y-2">
              {cart.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between bg-[#F0F7FF] border border-blue-100 rounded-xl px-3 py-2 gap-3">
                  <div className="flex-1 min-w-0 flex items-center gap-2.5">
                    {item.equipment.image_url && (
                      <img 
                        src={item.equipment.image_url} 
                        alt={item.equipment.name} 
                        className="w-8 h-8 object-contain rounded-lg shrink-0 border border-[#E8E8ED] p-0.5 bg-white"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-[#1D1D1F] truncate">{item.equipment.name}</p>
                      <p className="text-[10px] text-[#86868B] font-mono">{item.equipment.code}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => { const n=[...cart]; if(n[idx].qty>1)n[idx].qty--; else n.splice(idx,1); setCart(n); }}
                      className="w-6 h-6 bg-white border border-[#E8E8ED] rounded-lg text-sm font-bold text-[#1D1D1F] flex items-center justify-center hover:bg-gray-50 transition">-</button>
                    <span className="w-6 text-center text-xs font-bold">{item.qty}</span>
                    <button type="button" onClick={() => { const n=[...cart]; const avail=(n[idx].equipment.available_qty??1); if(n[idx].qty<avail)n[idx].qty++; setCart(n); }}
                      className="w-6 h-6 bg-white border border-[#E8E8ED] rounded-lg text-sm font-bold text-[#1D1D1F] flex items-center justify-center hover:bg-gray-50 transition">+</button>
                    <button type="button" onClick={() => removeFromCart(idx)}
                      className="w-6 h-6 text-red-400 hover:text-red-600 flex items-center justify-center transition">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex justify-between text-[10px] font-semibold text-[#86868B] pt-1 border-t border-[#E8E8ED] px-1">
                <span>{cart.length} ชนิด</span>
                <span className="text-[#000000] font-extrabold">รวม {cart.reduce((s,i)=>s+i.qty,0)} ชิ้น</span>
              </div>
            </div>
          )}

          {/* Add equipment */}
          <div className="border border-dashed border-[#C7C7CC] rounded-xl p-4 space-y-3">
            <p className="text-[10px] text-[#86868B] font-semibold uppercase tracking-wider">เพิ่มรายการพัสดุ</p>

            {/* Category filter */}
            {categories.length > 0 && (
              <div className="flex flex-nowrap overflow-x-auto gap-1.5 pb-2 -mx-1 px-1 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:bg-[#E8E8ED] [&::-webkit-scrollbar-thumb]:rounded-full">
                <button type="button" onClick={() => setSelectedCategory('')}
                  className={`text-[10px] px-3 py-1.5 rounded-full border font-semibold transition shrink-0 whitespace-nowrap ${!selectedCategory ? 'bg-[#000000] text-white border-[#000000]' : 'bg-white text-[#86868B] border-[#E8E8ED] hover:bg-[#F5F5F7]'}`}>
                  ทั้งหมด
                </button>
                {categories.map(cat => (
                  <button key={cat} type="button" onClick={() => setSelectedCategory(cat)}
                    className={`text-[10px] px-3 py-1.5 rounded-full border font-semibold transition shrink-0 whitespace-nowrap ${selectedCategory===cat ? 'bg-[#000000] text-white border-[#000000]' : 'bg-white text-[#86868B] border-[#E8E8ED] hover:bg-[#F5F5F7]'}`}>
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {/* Search + Select */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#86868B] pointer-events-none" />
              <input
                type="text"
                placeholder="ค้นหารหัสหรือชื่อพัสดุ..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-[#F5F5F7] border border-[#E8E8ED] rounded-xl text-xs focus:outline-none focus:bg-white focus:border-[#000000] transition"
              />
            </div>

            {loading ? (
              <p className="text-[11px] text-[#86868B] text-center py-2">กำลังโหลดรายการพัสดุ...</p>
            ) : (
              <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                {filteredEq.length === 0 ? (
                  <p className="text-[11px] text-[#86868B] text-center py-4">ไม่พบรายการพัสดุที่ว่าง</p>
                ) : filteredEq.map(eq => {
                  const inCart = cart.find(c => c.equipment.id === eq.id);
                  const inCartQty = inCart ? inCart.qty : 0;
                  const availableStock = eq.available_qty ?? 0;

                  return (
                    <div
                      key={eq.id}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl border bg-white border-[#E8E8ED] hover:bg-[#F5F5F7] transition gap-3"
                    >
                      <div className="min-w-0 flex-1 flex items-center gap-2.5">
                        {eq.image_url && (
                          <img 
                            src={eq.image_url} 
                            alt={eq.name} 
                            className="w-8 h-8 object-contain rounded-lg shrink-0 border border-[#E8E8ED] p-0.5 bg-white"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-[#1D1D1F] truncate">{eq.name}</p>
                          <p className="text-[10px] text-[#86868B] font-mono">
                            {eq.code} · คลังคงเหลือ {availableStock} ชิ้น
                          </p>
                        </div>
                      </div>

                      {/* Inline Selection & Qty Controls */}
                      <div className="flex items-center gap-2 shrink-0">
                        {inCart ? (
                          <div className="flex items-center gap-2 bg-[#F5F5F7] border border-[#E8E8ED] rounded-lg p-0.5 shadow-3xs">
                            <button
                              type="button"
                              onClick={() => {
                                const newCart = [...cart];
                                const idx = newCart.findIndex(c => c.equipment.id === eq.id);
                                if (newCart[idx].qty > 1) {
                                  newCart[idx].qty--;
                                } else {
                                  newCart.splice(idx, 1);
                                }
                                setCart(newCart);
                              }}
                              className="w-6 h-6 rounded-md text-xs font-bold text-black flex items-center justify-center hover:bg-white active:scale-95 transition cursor-pointer"
                            >
                              -
                            </button>
                            <span className="w-5 text-center text-xs font-extrabold font-mono text-black">
                              {inCartQty}
                            </span>
                            <button
                              type="button"
                              disabled={inCartQty >= availableStock}
                              onClick={() => {
                                const newCart = [...cart];
                                const idx = newCart.findIndex(c => c.equipment.id === eq.id);
                                if (newCart[idx].qty < availableStock) {
                                  newCart[idx].qty++;
                                }
                                setCart(newCart);
                              }}
                              className={`w-6 h-6 rounded-md text-xs font-bold flex items-center justify-center transition ${
                                inCartQty >= availableStock
                                  ? 'text-gray-300 cursor-not-allowed'
                                  : 'text-black hover:bg-white active:scale-95 cursor-pointer'
                              }`}
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setCart([...cart, { equipment: eq, qty: 1 }]);
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-black hover:bg-[#1D1D1F] active:scale-95 text-white rounded-lg text-[10px] font-bold transition shadow-3xs cursor-pointer"
                          >
                            <Plus className="h-3 w-3" /> เลือก
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Step 2: Requester info ── */}
        <div className="bg-white border border-[#E8E8ED] rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] space-y-4">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#1D1D1F] flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-[#000000]" />
            2. ข้อมูลผู้ยื่นคำขอ
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#86868B] mb-1.5">ชื่อ-นามสกุล *</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-[#86868B] pointer-events-none" />
                <input type="text" value={requesterName} onChange={e=>setRequesterName(e.target.value)}
                  placeholder="เช่น สมศักดิ์ แสนดี" required
                  className="w-full pl-9 pr-3 py-2 border border-[#E8E8ED] rounded-xl text-xs focus:outline-none focus:border-[#000000] bg-[#F5F5F7] focus:bg-white transition" />
              </div>
            </div>
            {/* Company */}
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#86868B] mb-1.5">บริษัท *</label>
              <div className="relative">
                <Briefcase className="absolute left-3 top-2.5 h-4 w-4 text-[#86868B] pointer-events-none" />
                <select value={requesterCompany} onChange={e=>setRequesterCompany(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-[#E8E8ED] rounded-xl text-xs focus:outline-none focus:border-[#000000] bg-[#F5F5F7] focus:bg-white transition appearance-none">
                  {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {requesterCompany === 'อื่นๆ ระบุ' && (
                <input type="text" value={customCompany} onChange={e=>setCustomCompany(e.target.value)}
                  placeholder="ระบุชื่อบริษัท..." required
                  className="mt-2 w-full px-3 py-2 border border-[#E8E8ED] rounded-xl text-xs focus:outline-none focus:border-[#000000] bg-white transition" />
              )}
            </div>
            {/* Contact */}
            <div className="md:col-span-2">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#86868B] mb-1.5">เบอร์ติดต่อ / อีเมล (ไม่บังคับ)</label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 h-4 w-4 text-[#86868B] pointer-events-none" />
                <input type="text" value={requesterContact} onChange={e=>setRequesterContact(e.target.value)}
                  placeholder="เช่น 081-234-5678 หรือ name@company.com"
                  className="w-full pl-9 pr-3 py-2 border border-[#E8E8ED] rounded-xl text-xs focus:outline-none focus:border-[#000000] bg-[#F5F5F7] focus:bg-white transition" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Step 3: Purpose & Date ── */}
        <div className="bg-white border border-[#E8E8ED] rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] space-y-4">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#1D1D1F] flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-[#000000]" />
            3. วัตถุประสงค์และวันที่
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Purpose */}
            <div className="md:col-span-2">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#86868B] mb-1.5">วัตถุประสงค์การใช้งาน</label>
              <div className="relative">
                <FileText className="absolute left-3 top-2.5 h-4 w-4 text-[#86868B] pointer-events-none" />
                <textarea rows={2} value={purpose} onChange={e=>setPurpose(e.target.value)}
                  placeholder="เช่น ใช้ในงานโครงการติดตั้งกล้องโครงการ X ที่..."
                  className="w-full pl-9 pr-3 py-2 border border-[#E8E8ED] rounded-xl text-xs focus:outline-none focus:border-[#000000] bg-[#F5F5F7] focus:bg-white transition resize-none" />
              </div>
            </div>
            {/* Due date */}
            <div className="md:col-span-2">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#86868B] mb-1.5">วันที่ต้องการคืนพัสดุ *</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-[#86868B] pointer-events-none" />
                <input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]} required
                  className="w-full pl-9 pr-3 py-2 border border-[#E8E8ED] rounded-xl text-xs focus:outline-none focus:border-[#000000] bg-[#F5F5F7] focus:bg-white transition" />
              </div>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className="text-[10px] text-[#86868B]">ระยะแนะนำ:</span>
                {[7, 14, 30].map(d => (
                  <button key={d} type="button" onClick={() => {
                    const dt = new Date(); dt.setDate(dt.getDate()+d);
                    setDueDate(`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`);
                  }} className="text-[10px] px-3 py-1 bg-[#F5F5F7] border border-[#E8E8ED] rounded-full font-semibold hover:bg-[#E8E8ED] transition">{d} วัน</button>
                ))}
              </div>
            </div>
          </div>
        </div>



        {/* Error */}
        {submitError && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{submitError}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#000000] hover:bg-[#1D1D1F] disabled:bg-[#86868B] text-white rounded-2xl text-sm font-bold transition-all shadow-[0_4px_20px_rgba(0,113,227,0.3)] hover:shadow-[0_6px_24px_rgba(0,113,227,0.4)] active:scale-[0.99]"
        >
          {submitting ? (
            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> กำลังส่งคำขอ...</>
          ) : (
            <><Send className="h-4 w-4" /> ส่งคำขอเบิกพัสดุ ({cart.reduce((s,i)=>s+i.qty,0)} ชิ้น)</>
          )}
        </button>
      </form>
    </div>
  );
}
