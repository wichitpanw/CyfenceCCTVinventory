/**
 * RequestView.tsx — หน้ายื่นคำขอเบิกพัสดุ (สาธารณะ ไม่ต้อง Login)
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ShoppingCart,
  User,
  Briefcase,
  Phone,
  Calendar,
  FileText,
  Search,
  Plus,
  Minus,
  CheckCircle,
  Send,
  X,
  ClipboardList,
  Copy,
  Check,
} from 'lucide-react';
import { Equipment, BorrowRequestItem, SupabaseConfig } from '../types';
import { getEquipments, createBorrowRequest } from '../services/db';
import { addDaysInputValue, todayInputValue } from '../lib/format';
import { rememberRequestId, getRequesterProfile, saveRequesterProfile } from '../lib/myRequests';
import { useToast } from './ui/Toast';

interface RequestViewProps {
  config: SupabaseConfig;
  refreshTrigger: number;
  /** ให้ผู้ขอกดไปดูสถานะคำขอของตัวเองต่อได้ทันที */
  onNavigate?: (tab: string) => void;
}

const COMPANIES = ['IQsafe', 'Insider', 'อื่นๆ ระบุ'];
const OTHER = 'อื่นๆ ระบุ';

type FieldErrors = Partial<Record<'cart' | 'name' | 'company' | 'contact' | 'purpose' | 'dueDate', string>>;

export default function RequestView({ config, refreshTrigger, onNavigate }: RequestViewProps) {
  const toast = useToast();

  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);

  const [cart, setCart] = useState<{ equipment: Equipment; qty: number }[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const profile = useMemo(() => getRequesterProfile(), []);
  const [requesterName, setRequesterName] = useState(profile?.name || '');
  const [requesterCompany, setRequesterCompany] = useState(profile?.company || COMPANIES[0]);
  const [customCompany, setCustomCompany] = useState(profile?.customCompany || '');
  const [requesterContact, setRequesterContact] = useState(profile?.contact || '');

  const [purpose, setPurpose] = useState('');
  const [dueDate, setDueDate] = useState(() => addDaysInputValue(7));

  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [successRefCode, setSuccessRefCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLoading(true);
    getEquipments(config)
      .then(setEquipments)
      .catch(e => toast.error(e?.message || 'โหลดรายการพัสดุไม่สำเร็จ'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, refreshTrigger]);

  const categories = useMemo(
    () => Array.from(new Set(equipments.map(e => e.category))).filter(Boolean).sort(),
    [equipments]
  );

  const filteredEq = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return equipments.filter(e => {
      if ((e.available_qty ?? 0) <= 0) return false;
      if (selectedCategory && e.category !== selectedCategory) return false;
      if (!term) return true;
      return e.name.toLowerCase().includes(term) || e.code.toLowerCase().includes(term);
    });
  }, [equipments, searchTerm, selectedCategory]);

  const totalPieces = cart.reduce((s, i) => s + i.qty, 0);

  // ── ตะกร้า ─────────────────────────────────────────────────────────────────
  const setQty = (equipmentId: string, nextQty: number) => {
    setErrors(e => ({ ...e, cart: undefined }));
    setCart(prev => {
      const idx = prev.findIndex(c => c.equipment.id === equipmentId);
      if (idx === -1) {
        const eq = equipments.find(e => e.id === equipmentId);
        if (!eq || nextQty <= 0) return prev;
        return [...prev, { equipment: eq, qty: Math.min(nextQty, eq.available_qty ?? 1) }];
      }
      const next = [...prev];
      const max = next[idx].equipment.available_qty ?? 1;
      if (nextQty <= 0) {
        next.splice(idx, 1);
        return next;
      }
      next[idx] = { ...next[idx], qty: Math.min(nextQty, max) };
      return next;
    });
  };

  const qtyInCart = (equipmentId: string) => cart.find(c => c.equipment.id === equipmentId)?.qty ?? 0;

  // ── ส่งคำขอ ────────────────────────────────────────────────────────────────
  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (cart.length === 0) next.cart = 'กรุณาเลือกพัสดุที่ต้องการขอเบิกอย่างน้อย 1 รายการ';
    if (!requesterName.trim()) next.name = 'กรุณาระบุชื่อ-นามสกุลผู้ยื่นคำขอ';
    if (requesterCompany === OTHER && !customCompany.trim()) next.company = 'กรุณาระบุชื่อบริษัท';
    if (!requesterContact.trim()) next.contact = 'กรุณาระบุเบอร์โทรติดต่อ';
    if (!purpose.trim()) next.purpose = 'กรุณาระบุวัตถุประสงค์การใช้งาน';
    if (!dueDate) next.dueDate = 'กรุณาระบุวันที่ต้องการคืนพัสดุ';
    return next;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      // เลื่อนไปยังช่องแรกที่ผิด แทนที่จะให้ผู้ใช้ไล่หาเอง
      document.querySelector('[data-field-error="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast.error('กรุณากรอกข้อมูลให้ครบก่อนส่งคำขอ');
      return;
    }

    const finalCompany = requesterCompany === OTHER ? customCompany.trim() : requesterCompany;
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
        requester_contact: requesterContact.trim(),
        items,
        purpose: purpose.trim(),
        requested_due_date: dueDate,
      });

      rememberRequestId(result.id);
      saveRequesterProfile({
        name: requesterName.trim(),
        company: requesterCompany,
        customCompany: customCompany.trim(),
        contact: requesterContact.trim(),
      });
      setSuccessRefCode(result.id);
    } catch (err: any) {
      toast.error(err?.message || 'ส่งคำขอไม่สำเร็จ โปรดลองใหม่อีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSuccessRefCode('');
    setCopied(false);
    setCart([]);
    setPurpose('');
    setErrors({});
  };

  // ── หน้าสำเร็จ ─────────────────────────────────────────────────────────────
  if (successRefCode) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 py-12 px-4">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
          <CheckCircle className="w-10 h-10 text-emerald-600" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-[#1D1D1F]">ส่งคำขอเบิกพัสดุเรียบร้อยแล้ว</h2>
          <p className="text-sm text-[#6E6E73]">ผู้ดูแลระบบจะตรวจสอบและแจ้งผลให้ทราบเร็ว ๆ นี้</p>
        </div>

        <div className="bg-[#F5F5F7] border border-[#E8E8ED] rounded-2xl p-6 w-full max-w-sm space-y-3">
          <p className="text-[11px] text-[#86868B] uppercase tracking-wider font-semibold">รหัสอ้างอิงคำขอของคุณ</p>
          <p className="text-base font-mono font-bold text-[#1D1D1F] break-all">{successRefCode}</p>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(successRefCode).then(
                () => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                },
                () => toast.error('คัดลอกไม่สำเร็จ กรุณาคัดลอกด้วยตนเอง')
              );
            }}
            className="w-full flex items-center justify-center gap-1.5 py-2 bg-white border border-[#E8E8ED] hover:bg-[#F5F5F7] rounded-xl text-xs font-bold text-[#1D1D1F] transition cursor-pointer"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'คัดลอกแล้ว' : 'คัดลอกรหัสอ้างอิง'}
          </button>
          <p className="text-[11px] text-[#86868B]">
            ระบบจำรหัสนี้ไว้ในเบราว์เซอร์นี้แล้ว — ดูได้จากเมนู "ติดตามคำขอ" แท็บคำขอของฉัน
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full max-w-sm">
          {onNavigate && (
            <button
              onClick={() => onNavigate('request_status')}
              className="flex-1 px-6 py-3 bg-[#1D1D1F] text-white rounded-xl text-sm font-semibold hover:bg-black transition cursor-pointer"
            >
              ไปดูสถานะคำขอ
            </button>
          )}
          <button
            onClick={handleReset}
            className="flex-1 px-6 py-3 bg-white border border-[#E8E8ED] text-[#1D1D1F] rounded-xl text-sm font-semibold hover:bg-[#F5F5F7] transition cursor-pointer"
          >
            ยื่นคำขอใหม่
          </button>
        </div>
      </div>
    );
  }

  // ── ฟอร์มหลัก ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 text-left pb-24 lg:pb-0" id="request-view-wrapper">
      <div>
        <h2 className="text-sm font-bold text-[#1D1D1F] uppercase tracking-wider flex items-center gap-2">
          <ClipboardList className="h-4 w-4" />
          ยื่นคำขอเบิกพัสดุ
        </h2>
        <p className="text-xs text-[#6E6E73] mt-0.5">
          กรอกรายละเอียดพัสดุที่ต้องการและข้อมูลผู้ขอ — เจ้าหน้าที่จะดำเนินการอนุมัติเร็ว ๆ นี้
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* ── 1. ตะกร้า ── */}
        <Section icon={<ShoppingCart className="h-3.5 w-3.5" />} title="1. รายการพัสดุที่ต้องการขอเบิก" error={errors.cart}>
          {cart.length > 0 && (
            <div className="space-y-2">
              {cart.map(item => (
                <div
                  key={item.equipment.id}
                  className="flex items-center justify-between bg-[#F0F7FF] border border-blue-100 rounded-xl px-3 py-2 gap-3"
                >
                  <div className="flex-1 min-w-0 flex items-center gap-2.5">
                    {item.equipment.image_url && (
                      <img
                        src={item.equipment.image_url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="w-8 h-8 object-contain rounded-lg shrink-0 border border-[#E8E8ED] p-0.5 bg-white"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#1D1D1F] truncate">{item.equipment.name}</p>
                      <p className="text-[11px] text-[#86868B] font-mono">{item.equipment.code}</p>
                    </div>
                  </div>
                  <QtyControl
                    value={item.qty}
                    max={item.equipment.available_qty ?? 1}
                    onChange={q => setQty(item.equipment.id, q)}
                    onRemove={() => setQty(item.equipment.id, 0)}
                  />
                </div>
              ))}
              <div className="flex justify-between text-[11px] font-semibold text-[#6E6E73] pt-1.5 border-t border-[#E8E8ED] px-1">
                <span>{cart.length} ชนิด</span>
                <span className="text-[#1D1D1F] font-extrabold">รวม {totalPieces} ชิ้น</span>
              </div>
            </div>
          )}

          <div className="border border-dashed border-[#C7C7CC] rounded-xl p-4 space-y-3">
            <p className="text-[11px] text-[#86868B] font-semibold uppercase tracking-wider">เพิ่มรายการพัสดุ</p>

            {categories.length > 0 && (
              <div className="flex flex-nowrap overflow-x-auto gap-1.5 pb-2 -mx-1 px-1">
                <CategoryChip active={!selectedCategory} onClick={() => setSelectedCategory('')}>
                  ทั้งหมด
                </CategoryChip>
                {categories.map(cat => (
                  <CategoryChip key={cat} active={selectedCategory === cat} onClick={() => setSelectedCategory(cat)}>
                    {cat}
                  </CategoryChip>
                ))}
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#86868B] pointer-events-none" />
              <input
                type="text"
                placeholder="ค้นหารหัสหรือชื่อพัสดุ..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-2.5 bg-[#F5F5F7] border border-[#E8E8ED] rounded-xl text-xs focus:outline-none focus:bg-white focus:border-[#1D1D1F] transition"
              />
            </div>

            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2].map(i => (
                  <div key={i} className="h-14 bg-[#F5F5F7] rounded-xl animate-pulse" />
                ))}
              </div>
            ) : filteredEq.length === 0 ? (
              <p className="text-xs text-[#86868B] text-center py-6">ไม่พบพัสดุที่ว่างตามเงื่อนไขที่ค้นหา</p>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                {filteredEq.map(eq => {
                  const inCart = qtyInCart(eq.id);
                  const stock = eq.available_qty ?? 0;
                  return (
                    <div
                      key={eq.id}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl border bg-white border-[#E8E8ED] hover:bg-[#F5F5F7] transition gap-3"
                    >
                      <div className="min-w-0 flex-1 flex items-center gap-2.5">
                        {eq.image_url && (
                          <img
                            src={eq.image_url}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="w-8 h-8 object-contain rounded-lg shrink-0 border border-[#E8E8ED] p-0.5 bg-white"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#1D1D1F] truncate">{eq.name}</p>
                          <p className="text-[11px] text-[#86868B] font-mono">
                            {eq.code} · คลังคงเหลือ {stock} ชิ้น
                          </p>
                        </div>
                      </div>

                      {inCart > 0 ? (
                        <QtyControl value={inCart} max={stock} onChange={q => setQty(eq.id, q)} />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setQty(eq.id, 1)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-[#1D1D1F] hover:bg-black active:scale-95 text-white rounded-lg text-[11px] font-bold transition cursor-pointer shrink-0"
                        >
                          <Plus className="h-3 w-3" /> เลือก
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Section>

        {/* ── 2. ข้อมูลผู้ยื่นคำขอ ── */}
        <Section icon={<User className="h-3.5 w-3.5" />} title="2. ข้อมูลผู้ยื่นคำขอ">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="ชื่อ-นามสกุล *" error={errors.name}>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-[#86868B] pointer-events-none" />
                <input
                  type="text"
                  value={requesterName}
                  onChange={e => {
                    setRequesterName(e.target.value);
                    setErrors(x => ({ ...x, name: undefined }));
                  }}
                  placeholder="เช่น สมศักดิ์ แสนดี"
                  className={inputCls(!!errors.name, 'pl-9')}
                />
              </div>
            </Field>

            <Field label="บริษัท *" error={errors.company}>
              <div className="relative">
                <Briefcase className="absolute left-3 top-3 h-4 w-4 text-[#86868B] pointer-events-none" />
                <select
                  value={requesterCompany}
                  onChange={e => {
                    setRequesterCompany(e.target.value);
                    setErrors(x => ({ ...x, company: undefined }));
                  }}
                  className={inputCls(false, 'pl-9 cursor-pointer')}
                >
                  {COMPANIES.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              {requesterCompany === OTHER && (
                <input
                  type="text"
                  value={customCompany}
                  onChange={e => {
                    setCustomCompany(e.target.value);
                    setErrors(x => ({ ...x, company: undefined }));
                  }}
                  placeholder="ระบุชื่อบริษัท..."
                  className={inputCls(!!errors.company) + ' mt-2'}
                />
              )}
            </Field>

            <div className="md:col-span-2">
              <Field label="เบอร์โทรติดต่อ *" error={errors.contact}>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-[#86868B] pointer-events-none" />
                  <input
                    type="tel"
                    inputMode="tel"
                    value={requesterContact}
                    onChange={e => {
                      setRequesterContact(e.target.value);
                      setErrors(x => ({ ...x, contact: undefined }));
                    }}
                    placeholder="เช่น 081-234-5678"
                    className={inputCls(!!errors.contact, 'pl-9')}
                  />
                </div>
              </Field>
            </div>
          </div>
        </Section>

        {/* ── 3. วัตถุประสงค์และวันที่ ── */}
        <Section icon={<FileText className="h-3.5 w-3.5" />} title="3. วัตถุประสงค์และกำหนดคืน">
          <Field label="วัตถุประสงค์การใช้งาน / สถานที่ปฏิบัติงาน *" error={errors.purpose}>
            <textarea
              rows={3}
              value={purpose}
              onChange={e => {
                setPurpose(e.target.value);
                setErrors(x => ({ ...x, purpose: undefined }));
              }}
              placeholder="เช่น ใช้ในงานติดตั้งกล้องโครงการ X ที่อาคาร..."
              className={inputCls(!!errors.purpose) + ' resize-none'}
            />
          </Field>

          <Field label="วันที่ต้องการคืนพัสดุ *" error={errors.dueDate}>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 h-4 w-4 text-[#86868B] pointer-events-none" />
              <input
                type="date"
                value={dueDate}
                min={todayInputValue()}
                onChange={e => {
                  setDueDate(e.target.value);
                  setErrors(x => ({ ...x, dueDate: undefined }));
                }}
                className={inputCls(!!errors.dueDate, 'pl-9')}
              />
            </div>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="text-[11px] text-[#86868B]">ระยะแนะนำ:</span>
              {[7, 14, 30].map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDueDate(addDaysInputValue(d))}
                  className="text-[11px] px-3 py-1 bg-[#F5F5F7] border border-[#E8E8ED] rounded-full font-semibold hover:bg-[#E8E8ED] transition cursor-pointer"
                >
                  {d} วัน
                </button>
              ))}
            </div>
          </Field>
        </Section>

        {/* ปุ่มส่งบนจอใหญ่ */}
        <button
          type="submit"
          disabled={submitting}
          className="hidden lg:flex w-full items-center justify-center gap-2 py-3.5 bg-[#1D1D1F] hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl text-sm font-bold transition active:scale-[0.99] cursor-pointer"
        >
          {submitting ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> กำลังส่งคำขอ...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" /> ส่งคำขอเบิกพัสดุ ({totalPieces} ชิ้น)
            </>
          )}
        </button>

        {/* แถบสรุป + ปุ่มส่ง ติดขอบล่างบนมือถือ */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#E8E8ED] px-4 py-3 flex items-center gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-[#86868B] font-semibold">{cart.length} ชนิด</p>
            <p className="text-sm font-extrabold text-[#1D1D1F] leading-tight">{totalPieces} ชิ้น</p>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#1D1D1F] hover:bg-black disabled:opacity-50 text-white rounded-xl text-sm font-bold transition cursor-pointer"
          >
            {submitting ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            ส่งคำขอ
          </button>
        </div>
      </form>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────── */

function inputCls(hasError: boolean, extra = '') {
  return `w-full ${extra.includes('pl-') ? '' : 'px-3'} pr-3 py-2.5 border rounded-xl text-xs bg-[#F5F5F7] focus:bg-white focus:outline-none transition ${
    hasError ? 'border-red-300 focus:border-red-500' : 'border-[#E8E8ED] focus:border-[#1D1D1F]'
  } ${extra}`;
}

function Section({
  icon,
  title,
  error,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-field-error={error ? 'true' : undefined}
      className={`bg-white border rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.04)] space-y-4 ${
        error ? 'border-red-200' : 'border-[#E8E8ED]'
      }`}
    >
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#1D1D1F] flex items-center gap-2">
        {icon}
        {title}
      </h3>
      {children}
      {error && <p className="text-[11px] text-red-600 font-semibold">{error}</p>}
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div data-field-error={error ? 'true' : undefined}>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#86868B] mb-1.5">{label}</label>
      {children}
      {error && <p className="text-[11px] text-red-600 font-semibold mt-1">{error}</p>}
    </div>
  );
}

function CategoryChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[11px] px-3 py-1.5 rounded-full border font-semibold transition shrink-0 whitespace-nowrap cursor-pointer ${
        active ? 'bg-[#1D1D1F] text-white border-[#1D1D1F]' : 'bg-white text-[#6E6E73] border-[#E8E8ED] hover:bg-[#F5F5F7]'
      }`}
    >
      {children}
    </button>
  );
}

function QtyControl({
  value,
  max,
  onChange,
  onRemove,
}: {
  value: number;
  max: number;
  onChange: (next: number) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <div className="flex items-center gap-1 bg-[#F5F5F7] border border-[#E8E8ED] rounded-lg p-0.5">
        <button
          type="button"
          onClick={() => onChange(value - 1)}
          className="w-7 h-7 rounded-md flex items-center justify-center text-[#1D1D1F] hover:bg-white active:scale-95 transition cursor-pointer"
          aria-label="ลดจำนวน"
        >
          <Minus className="h-3 w-3" />
        </button>
        <input
          type="number"
          min={1}
          max={max}
          value={value}
          onChange={e => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v)) onChange(v);
          }}
          onBlur={e => {
            const v = parseInt(e.target.value, 10);
            if (isNaN(v) || v < 1) onChange(1);
          }}
          className="w-10 text-center text-xs font-extrabold font-mono text-[#1D1D1F] bg-transparent border-none focus:outline-none p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          aria-label="จำนวน"
        />
        <button
          type="button"
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
          className="w-7 h-7 rounded-md flex items-center justify-center text-[#1D1D1F] hover:bg-white active:scale-95 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="เพิ่มจำนวน"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="w-7 h-7 text-red-500 hover:text-red-700 flex items-center justify-center transition cursor-pointer"
          aria-label="ลบออกจากตะกร้า"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
