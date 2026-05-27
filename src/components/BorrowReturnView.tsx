/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  Calendar, 
  User, 
  Briefcase, 
  FileText, 
  AlertCircle, 
  CheckCircle,
  Clock, 
  Tag, 
  Search,
  CheckCircle2,
  AlertTriangle,
  XOctagon,
  X,
  Plus,
  Trash2,
  Camera,
  UploadCloud,
  ShoppingCart
} from 'lucide-react';
import { Equipment, Transaction, SupabaseConfig } from '../types';
import { getEquipments, getTransactions, borrowEquipment, returnEquipment } from '../services/db';

interface BorrowReturnViewProps {
  config: SupabaseConfig;
  refreshTrigger: number;
  onRefresh: () => void;
  quickReturnTx: Transaction | null;
  onClearQuickReturn: () => void;
}

const COMPANIES = [
  'NT',
  'IQsafe',
  'Insider',
  'อื่นๆ ระบุ'
];

// Helper to compress and convert image files to Base64 (saving space in supadb & storage)
const compressAndConvertToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Fill white background to handle PNG transparency
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
        }
        const dataUrl = canvas.toDataURL('image/jpeg', 0.75); // 75% quality JPEG
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (error) => reject(error);
  });
};

export default function BorrowReturnView({ config, refreshTrigger, onRefresh, quickReturnTx, onClearQuickReturn }: BorrowReturnViewProps) {
  const [activeSubTab, setActiveSubTab] = useState<'borrow' | 'return'>('borrow');
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormSubmitting, setIsFormSubmitting] = useState(false);
  
  // Messages state
  const [borrowError, setBorrowError] = useState('');
  const [borrowSuccess, setBorrowSuccess] = useState('');
  const [returnError, setReturnError] = useState('');
  const [returnSuccess, setReturnSuccess] = useState('');

  // Borrow Form State (Converted to Cart approach)
  const [cart, setCart] = useState<{ equipment: Equipment; qty: number }[]>([]);
  const [selectedEqId, setSelectedEqId] = useState('');
  const [borrowerName, setBorrowerName] = useState('');
  const [borrowerDepartment, setBorrowerDepartment] = useState(COMPANIES[0]);
  const [customCompany, setCustomCompany] = useState('');
  const [purpose, setPurpose] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [searchTermEq, setSearchTermEq] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [borrowQty, setBorrowQty] = useState<number>(1);

  // Evidence Image State (Step 6)
  const [evidenceImage, setEvidenceImage] = useState<string>('');
  const [evidenceSourceMode, setEvidenceSourceMode] = useState<'upload' | 'url'>('upload');

  // Automatically reset borrowQty to 1 when selected equipment changes
  useEffect(() => {
    setBorrowQty(1);
    setBorrowError('');
  }, [selectedEqId]);

  // Return Process State
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedTxForReturn, setSelectedTxForReturn] = useState<Transaction | null>(null);
  const [conditionOnReturn, setConditionOnReturn] = useState('ปกติ เรียบร้อยดี');
  const [itemConditionStatus, setItemConditionStatus] = useState<'available' | 'maintenance' | 'broken'>('available');
  const [searchTermReturn, setSearchTermReturn] = useState('');
  const [returnFilterStartDate, setReturnFilterStartDate] = useState('');
  const [returnFilterEndDate, setReturnFilterEndDate] = useState('');
  const [returnFilterDateType, setReturnFilterDateType] = useState<'borrow' | 'due'>('due');
  const [activeLightboxUrl, setActiveLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [fetchedEq, fetchedTxs] = await Promise.all([
          getEquipments(config),
          getTransactions(config)
        ]);
        setEquipments(fetchedEq);
        setTransactions(fetchedTxs);
      } catch (err) {
        console.error('Failed to lead borrow return data', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [config, refreshTrigger]);

  // Hook into quick return action from Dashboard
  useEffect(() => {
    if (quickReturnTx) {
      setActiveSubTab('return');
      openReturnDialog(quickReturnTx);
      onClearQuickReturn();
    }
  }, [quickReturnTx]);

  const handleSetQuickDays = (days: number) => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);
    // Format to yyyy-MM-dd
    const yyyy = targetDate.getFullYear();
    const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
    const dd = String(targetDate.getDate()).padStart(2, '0');
    setDueDate(`${yyyy}-${mm}-${dd}`);
  };

  // Pre-load default due date (3 days from now)
  useEffect(() => {
    if (!dueDate) {
      handleSetQuickDays(3);
    }
  }, []);

  const addToCart = (eq: Equipment, qty: number) => {
    if (!eq) return;
    const existingIndex = cart.findIndex(item => item.equipment.id === eq.id);
    const totalInCart = existingIndex !== -1 ? cart[existingIndex].qty : 0;
    const avail = eq.available_qty ?? 1;
    const targetQty = totalInCart + qty;

    if (targetQty > avail) {
      setBorrowError(`ไม่สามารถเลือกจำนวนเกินของที่มีในคลังได้ (ในตะกร้ามี ${totalInCart} ชิ้น, คลังพร้อมโยนให้เบิกได้สูงสุด ${avail} ชิ้น)`);
      return;
    }

    if (existingIndex !== -1) {
      const newCart = [...cart];
      newCart[existingIndex].qty = targetQty;
      setCart(newCart);
    } else {
      setCart([...cart, { equipment: eq, qty }]);
    }
    setBorrowError('');
    setSelectedEqId('');
  };

  const removeFromCart = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  const updateCartQty = (index: number, newQty: number) => {
    const eq = cart[index].equipment;
    const avail = eq.available_qty ?? 1;
    if (newQty <= 0) {
      removeFromCart(index);
      return;
    }
    if (newQty > avail) {
      setBorrowError(`ไม่สามารถขอเบิกเกินจำนวนที่มีในคลังได้ (คลังมีว่างสูงสุด ${avail} ชิ้น)`);
      return;
    }
    const newCart = [...cart];
    newCart[index].qty = newQty;
    setCart(newCart);
    setBorrowError('');
  };

  const handleEvidenceFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setBorrowError('กรุณาเลือกอัปโหลดเฉพาะไฟล์รูปภาพหลักฐาน เช่น ภาพถ่ายพัสดุหรืองานเบิกค่ะ');
      return;
    }
    try {
      const base64Data = await compressAndConvertToBase64(file);
      setEvidenceImage(base64Data);
      setBorrowError('');
    } catch (err) {
      setBorrowError('เกิดข้อผิดพลาดในการรับรู้ภาพถ่ายหลักฐาน โปรดลองใหม่อีกครั้ง');
    }
  };

  const handleBorrowSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBorrowError('');
    setBorrowSuccess('');

    if (cart.length === 0) {
      setBorrowError('กรุณาเลือกอุปกรณ์จากรายการขวามือ และกดบันทึกเพิ่มเข้าตะกร้าเบิกก่อนค่ะ');
      return;
    }
    if (!borrowerName.trim()) {
      setBorrowError('กรุณาระบุชื่อผู้ขอเบิกยืม');
      return;
    }
    if (!dueDate) {
      setBorrowError('กรุณากำหนดวันส่งมอบคืนพัสดุ');
      return;
    }

    let finalDepartment = borrowerDepartment;
    if (borrowerDepartment === 'อื่นๆ ระบุ') {
      if (!customCompany.trim()) {
        setBorrowError('กรุณาระบุชื่อบริษัทสัญชาติอื่นที่ต้องการยืม');
        return;
      }
      finalDepartment = customCompany.trim();
    }

    setIsFormSubmitting(true);
    let successCount = 0;
    const failedNames: string[] = [];

    // Loop through all cart items to save transactions sequentially
    for (const item of cart) {
      try {
        await borrowEquipment(config, item.equipment, {
          borrowerName: borrowerName.trim(),
          borrowerDepartment: finalDepartment,
          purpose: purpose.trim(),
          dueDate,
          borrowQty: item.qty,
          evidenceImageUrl: evidenceImage || undefined
        });
        successCount++;
      } catch (err: any) {
        console.error(`Failed to record borrow transaction for ${item.equipment.name}`, err);
        failedNames.push(item.equipment.name);
      }
    }

    setIsFormSubmitting(false);

    if (successCount === cart.length) {
      setBorrowSuccess(`🎉 ทำรายการเสนอเบิกอุปกรณ์สำเร็จเรียบร้อยครบถ้วนทั้งสิ้น ${successCount} รายการ รวมจำหน่ายออกสำเร็จแล้วค่ะ!`);
      // Clear values upon complete success
      setCart([]);
      setBorrowerName('');
      setPurpose('');
      setEvidenceImage('');
      setCustomCompany('');
      setBorrowerDepartment(COMPANIES[0]);
      onRefresh();
    } else if (successCount > 0) {
      setBorrowSuccess(`⚠️ ทำรายการเสนอเบิกสำเร็จบางส่วน (${successCount}/${cart.length} ตะกร้า) ส่วนที่ล้มเหลว: ${failedNames.join(', ')}`);
      // Keep only failed items in cart so user can adjust or resubmit
      const kept = cart.filter(item => failedNames.includes(item.equipment.name));
      setCart(kept);
      onRefresh();
    } else {
      setBorrowError(`🚨 ไม่สามารถเสนอเบิกชิ้นใดได้สำเร็จเลย: ${failedNames.join(', ')} โปรดตรวจสอบจำนวนคงเหลือหรือสิทธิ์ RLS บนคลาวด์`);
    }
  };

  const openReturnDialog = (tx: Transaction) => {
    setSelectedTxForReturn(tx);
    setConditionOnReturn('ปกติ เรียบร้อยดี');
    setItemConditionStatus('available');
    setReturnError('');
    setReturnSuccess('');
    setIsReturnModalOpen(true);
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReturnError('');
    setReturnSuccess('');

    if (!selectedTxForReturn) return;

    try {
      await returnEquipment(config, selectedTxForReturn.id, {
        conditionOnReturn,
        itemConditionStatus
      });

      setReturnSuccess(`ส่งคืนอุปกรณ์ "${selectedTxForReturn.equipment_name}" และบันทึกเข้าสู่คลังสำเร็จ!`);
      onRefresh();
      setTimeout(() => {
        setIsReturnModalOpen(false);
        setSelectedTxForReturn(null);
      }, 1500);
    } catch (err: any) {
      setReturnError(`เกิดข้อผิดพลาดในการทำเรื่องส่งคืน: ${err?.message || 'ระบบขัดข้อง'}`);
    }
  };

  // Equipments that are available for borrow and match search & category filter
  const availableEquipments = equipments.filter(item => {
    const isAvail = (item.available_qty ?? (item.status === 'borrowed' ? 0 : 1)) > 0;
    const matchesSearch = 
      item.name.toLowerCase().includes(searchTermEq.toLowerCase()) || 
      item.code.toLowerCase().includes(searchTermEq.toLowerCase());
    const matchesCategory = !selectedCategory || item.category === selectedCategory;
    return isAvail && matchesSearch && matchesCategory;
  });

  // Active borrows
  const activeBorrows = transactions.filter(tx => {
    const isBorrowed = tx.status === 'borrowing' || tx.status === 'overdue';
    const matchesSearch = 
      tx.borrower_name.toLowerCase().includes(searchTermReturn.toLowerCase()) || 
      tx.equipment_name.toLowerCase().includes(searchTermReturn.toLowerCase()) || 
      tx.equipment_code.toLowerCase().includes(searchTermReturn.toLowerCase());
    
    // Date Range Filtering
    let matchesDate = true;
    if (returnFilterStartDate || returnFilterEndDate) {
      const compareDateStr = returnFilterDateType === 'borrow' ? tx.borrow_date : tx.due_date;
      if (!compareDateStr) {
        matchesDate = false;
      } else {
        const compareDate = new Date(compareDateStr);
        compareDate.setHours(0, 0, 0, 0);

        if (returnFilterStartDate) {
          const start = new Date(returnFilterStartDate);
          start.setHours(0, 0, 0, 0);
          if (compareDate < start) matchesDate = false;
        }
        if (returnFilterEndDate) {
          const end = new Date(returnFilterEndDate);
          end.setHours(23, 59, 59, 999);
          if (compareDate > end) matchesDate = false;
        }
      }
    }

    return isBorrowed && matchesSearch && matchesDate;
  });

  return (
    <div className="space-y-6" id="borrow-return-root">
      {/* Top bar & Sub-nav */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-apple-border pb-4" id="borrow-return-header">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-apple-dark">กระดานเบิก - คืน พัสดุ</h2>
          <p className="text-xs text-apple-gray-dark mt-0.5">ลงทะเบียนรับเข้าของออก ยืมไปใช้งาน และสแกนส่งมอบพัสดุคืนคลัง</p>
        </div>

        {/* Local pill switcher */}
        <div className="bg-[#E8E8ED]/60 p-1 rounded-full flex items-center shrink-0 border border-apple-border" id="tab-switcher">
          <button
            onClick={() => { setActiveSubTab('borrow'); onRefresh(); }}
            className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-300 cursor-pointer ${
              activeSubTab === 'borrow' 
                ? 'bg-white text-apple-dark shadow-sm' 
                : 'text-apple-gray-dark hover:text-apple-dark'
            }`}
          >
            <ArrowUpRight className="h-3.5 w-3.5 text-apple-blue" />
            <span>ทำรายการเบิกอุปกรณ์</span>
          </button>
          <button
            onClick={() => { setActiveSubTab('return'); onRefresh(); }}
            className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all duration-300 cursor-pointer ${
              activeSubTab === 'return' 
                ? 'bg-white text-apple-dark shadow-sm' 
                : 'text-apple-gray-dark hover:text-apple-dark'
            }`}
          >
            <ArrowDownLeft className="h-3.5 w-3.5 text-apple-blue" />
            <span>รายการส่งมอบคืนคลัง</span>
            {transactions.filter(x => x.status === 'borrowing' || x.status === 'overdue').length > 0 && (
              <span className="text-[10px] bg-apple-blue text-white font-bold px-2 py-0.5 rounded-full min-w-[18px] flex items-center justify-center">
                {transactions.filter(x => x.status === 'borrowing' || x.status === 'overdue').length}
              </span>
            )}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-apple-border shadow-apple-card">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-apple-blue border-t-transparent mb-4"></div>
          <p className="text-apple-gray-dark text-xs">กำลังประมวลยอดคัดแยก...</p>
        </div>
      ) : activeSubTab === 'borrow' ? (
        /* --- BORROW FORM TAB --- */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="borrow-layout-grid">
          {/* Borrow Inputs Form (Left) */}
          <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-apple-border shadow-apple-card text-left" id="borrow-form-col">
            <h3 className="text-sm font-bold text-apple-dark border-b border-apple-border pb-3 mb-5 flex items-center gap-2 tracking-tight">
              <ShoppingCart className="h-4 w-4 text-apple-blue" /> ระบุรายละเอียดและสรุปตะกร้าอุปกรณ์เสนอเบิก
            </h3>

            <form onSubmit={handleBorrowSubmit} className="space-y-5">
              {borrowError && (
                <div className="bg-red-55 border border-[#FFEBEA] text-apple-error p-3.5 rounded-xl text-xs flex items-start gap-2 animate-fade-in font-medium">
                  <AlertCircle className="h-4 w-4 text-apple-error shrink-0 mt-0.5" />
                  <span>{borrowError}</span>
                </div>
              )}
              {borrowSuccess && (
                <div className="bg-[#EAF9EE] border border-[#EAF9EE] text-apple-success p-3.5 rounded-xl text-xs flex items-start gap-2 font-medium animate-pulse">
                  <CheckCircle className="h-4 w-4 text-apple-success shrink-0 mt-0.5" />
                  <span>{borrowSuccess}</span>
                </div>
              )}

              {/* Step 1: Cart Items List */}
              <div className="space-y-2">
                <label className="block text-[11px] text-apple-gray-dark font-semibold uppercase tracking-wider mb-1">
                  1. รายการอุปกรณ์ที่จะเบิกในรอบนี้ * ({cart.length} ชนิด)
                </label>
                
                {cart.length === 0 ? (
                  <div className="bg-apple-gray border border-dashed border-apple-border p-8 text-center rounded-2xl">
                    <ShoppingCart className="h-8 w-8 text-apple-gray-dark/50 mx-auto mb-2.5 opacity-60" />
                    <p className="text-xs text-apple-dark font-semibold">ยังไม่มีรายการเสนอเบิกในตะกร้าค่ะ</p>
                    <p className="text-[10px] text-apple-gray-dark mt-1">
                      กรุณาเลือกอุปกรณ์จากแผงด้านขวามือระบุจำนวน แล้วกดปุ่ม <span className="font-bold text-apple-blue">"เพิ่มเข้าตะกร้าเบิก 🛒"</span>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 border border-apple-border rounded-2xl p-3 bg-[#F5F5F7] max-h-72 overflow-y-auto">
                    {cart.map((item, idx) => (
                      <div 
                        key={item.equipment.id} 
                        className="bg-white border border-apple-border p-3 rounded-xl flex items-center justify-between gap-3 text-left shadow-[0_2px_8px_rgba(0,0,0,0.02)]"
                      >
                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                          <img 
                            src={item.equipment.image_url} 
                            alt="E" 
                            className="w-10 h-10 object-contain bg-apple-gray p-1.5 rounded-xl shrink-0 border border-apple-border"
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-bold text-apple-dark truncate leading-snug">
                              {item.equipment.name}
                            </h4>
                            <p className="text-[10px] text-apple-gray-dark truncate mt-0.5">
                              รหัส: <span className="font-mono font-bold text-apple-dark/70">{item.equipment.code}</span> · ว่างเหลือ {item.equipment.available_qty ?? 1} ชิ้น
                            </p>
                          </div>
                        </div>

                        {/* Qty Manager & Delete buttons */}
                        <div className="flex items-center space-x-3 shrink-0">
                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => updateCartQty(idx, item.qty - 1)}
                              className="w-7 h-7 bg-apple-gray hover:bg-[#E8E8ED] text-apple-dark font-bold rounded-lg flex items-center justify-center text-sm transition cursor-pointer select-none"
                            >
                              -
                            </button>
                            <span className="w-8 text-center text-xs font-bold text-apple-dark">{item.qty}</span>
                            <button
                              type="button"
                              onClick={() => updateCartQty(idx, item.qty + 1)}
                              className="w-7 h-7 bg-apple-gray hover:bg-[#E8E8ED] text-apple-dark font-bold rounded-lg flex items-center justify-center text-sm transition cursor-pointer select-none"
                            >
                              +
                            </button>
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => removeFromCart(idx)}
                            className="p-1.5 text-apple-gray-dark hover:text-apple-error rounded-lg hover:bg-red-50 transition cursor-pointer"
                            title="ลบออกจากใบเบิก"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    
                    <div className="flex justify-between items-center pt-3 px-1 text-apple-gray-dark text-[10px] font-bold uppercase tracking-wider border-t border-apple-border mt-1">
                      <span>รวมรายการพัสดุ: {cart.length} ชนิด</span>
                      <span className="text-apple-blue font-extrabold">จำนวนรวมทั้งสิ้น: {cart.reduce((s, i) => s + i.qty, 0)} ชิ้น</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Borrower profile */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] text-apple-gray-dark font-semibold uppercase tracking-wider mb-1.5">2. ชื่อ-นามสกุล ผู้เสนอเบิก *</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3.5 h-4 w-4 text-apple-gray-dark pointer-events-none" />
                    <input
                      type="text"
                      value={borrowerName}
                      onChange={(e) => setBorrowerName(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-apple-border rounded-xl text-xs focus:outline-none"
                      placeholder="เช่น สมศักดิ์ แสนดี"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] text-apple-gray-dark font-semibold uppercase tracking-wider mb-1.5">3. บริษัทผู้ยืม *</label>
                  <div className="relative">
                    <Briefcase className="absolute left-3.5 top-3.5 h-4 w-4 text-apple-gray-dark pointer-events-none" />
                    <select
                      value={borrowerDepartment}
                      onChange={(e) => setBorrowerDepartment(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 border border-apple-border rounded-xl text-xs focus:outline-none bg-apple-gray"
                    >
                      {COMPANIES.map(company => (
                        <option key={company} value={company}>{company}</option>
                      ))}
                    </select>
                  </div>
                  {borrowerDepartment === 'อื่นๆ ระบุ' && (
                    <div className="mt-2 animate-in fade-in-50 duration-200">
                      <label className="block text-[10px] text-apple-blue font-semibold uppercase tracking-wider mb-1">ระบุชื่อบริษัทอื่นๆ *</label>
                      <input
                        type="text"
                        value={customCompany}
                        onChange={(e) => setCustomCompany(e.target.value)}
                        className="w-full px-3 py-2 border border-apple-border rounded-xl text-xs focus:outline-none bg-white"
                        placeholder="ระบุบริษัทของคุณ..."
                        required
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Step 3: Dates pick */}
              <div>
                <label className="block text-[11px] text-apple-gray-dark font-semibold uppercase tracking-wider mb-1.5">4. กำหนดวันส่งมอบคืนพัสดุ *</label>
                <div className="relative mb-2.5">
                  <Calendar className="absolute left-3.5 top-3.5 h-4 w-4 text-apple-gray-dark pointer-events-none" />
                  <input
                    type="date"
                    value={dueDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-apple-border rounded-xl text-xs focus:outline-none"
                    required
                  />
                </div>
                {/* Fast selectors */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-apple-gray-dark">ระยะยืมแนะนำ:</span>
                  {[3, 5, 7, 14].map(days => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => handleSetQuickDays(days)}
                      className="text-[10px] py-1 px-3 bg-apple-gray border border-apple-border rounded-full text-apple-dark hover:bg-[#E8E8ED] font-semibold transition-all cursor-pointer"
                    >
                      {days} วัน
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 4: Purpose */}
              <div>
                <label className="block text-[11px] text-apple-gray-dark font-semibold uppercase tracking-wider mb-1.5">5. วัตถุประสงค์ในการเบิกใช้พัสดุ</label>
                <div className="relative">
                  <FileText className="absolute left-3.5 top-3.5 h-4 w-4 text-apple-gray-dark pointer-events-none" />
                  <textarea
                    rows={2}
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-apple-border rounded-xl text-xs focus:outline-none"
                    placeholder="เช่น ใช้จัดทำไลฟ์ประชุม, ติดหน้างานนอกสถานที่"
                  />
                </div>
              </div>

              {/* Step 6: Evidence image uploads for audit files */}
              <div className="bg-apple-gray border border-apple-border p-4 rounded-2xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-apple-border pb-3">
                  <div>
                    <label className="block text-[11px] text-apple-dark font-bold uppercase tracking-wider">
                      6. รูปประกอบหลักฐาน
                    </label>
                  </div>
                  
                  {/* Image source pill */}
                  <div className="bg-[#E8E8ED]/60 p-0.5 rounded-full flex items-center inline-flex self-start text-[10px] border border-apple-border font-semibold">
                    <button
                      type="button"
                      onClick={() => { setEvidenceSourceMode('upload'); setEvidenceImage(''); }}
                      className={`px-3 py-1 rounded-full ${evidenceSourceMode === 'upload' ? 'bg-white text-apple-dark shadow-xs' : 'text-apple-gray-dark'}`}
                    >
                      อัปโหลดรูป
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEvidenceSourceMode('url'); setEvidenceImage(''); }}
                      className={`px-3 py-1 rounded-full ${evidenceSourceMode === 'url' ? 'bg-white text-apple-dark shadow-xs' : 'text-apple-gray-dark'}`}
                    >
                      แนบลิงก์ URL
                    </button>
                  </div>
                </div>

                {evidenceSourceMode === 'upload' ? (
                  <div className="space-y-3">
                    {evidenceImage ? (
                      <div className="flex flex-col items-center justify-center p-3 border border-apple-border rounded-2xl bg-white relative">
                        <div className="relative w-40 h-32 border border-apple-border bg-apple-gray rounded-xl overflow-hidden flex items-center justify-center">
                          <img 
                            src={evidenceImage} 
                            alt="Evidence visual" 
                            className="w-full h-full object-contain p-1.5"
                          />
                          <button
                            type="button"
                            onClick={() => setEvidenceImage('')}
                            className="absolute top-1.5 right-1.5 p-1 bg-[#1D1D1F]/70 hover:bg-[#1D1D1F] rounded-full text-white transition cursor-pointer"
                            title="ลบรูปหลักฐาน"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <span className="text-[10px] font-mono text-apple-gray-dark mt-2">หลักฐานถูกเข้ารหัส Base64 สำเร็จ</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-apple-border border-dashed rounded-2xl cursor-pointer bg-white hover:bg-apple-gray/50 transition duration-200">
                          <div className="flex flex-col items-center justify-center pt-4 pb-4">
                            <UploadCloud className="w-7 h-7 mb-1.5 text-apple-gray-dark opacity-80" />
                            <p className="mb-0.5 text-xs text-apple-dark font-semibold">คลิกที่นี่ หรือถ่ายรูปผู้รับพัสดุ</p>
                            <p className="text-[10px] text-apple-gray-dark">PNG, JPG, WebP (บีบอัดอัตโนมัติ)</p>
                          </div>
                          <input 
                            type="file" 
                            className="hidden" 
                            accept="image/*" 
                            onChange={handleEvidenceFileChange}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <input
                      type="url"
                      value={evidenceImage}
                      onChange={(e) => setEvidenceImage(e.target.value)}
                      placeholder="เช่น https://images.unsplash.com/photo-..."
                      className="w-full px-3 py-2 border border-apple-border bg-white rounded-xl text-xs focus:outline-none"
                    />
                    {evidenceImage && (
                      <div className="flex items-center justify-center p-3 border border-apple-border rounded-2xl bg-white">
                        <div className="relative w-40 h-32 border border-apple-border bg-apple-gray rounded-xl overflow-hidden flex items-center justify-center">
                          <img 
                            src={evidenceImage} 
                            alt="Evidence Preview" 
                            className="w-full h-full object-contain p-1.5"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1557862921-37829c790f19?w=500&auto=format&fit=crop&q=80';
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setEvidenceImage('')}
                            className="absolute top-1.5 right-1.5 p-1 bg-[#1D1D1F]/70 hover:bg-[#1D1D1F] rounded-full text-white transition cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Submit borrow */}
              <button
                type="submit"
                disabled={isFormSubmitting || cart.length === 0}
                className={`w-full text-white font-semibold text-sm py-3 px-5 rounded-xl shadow-[0_4px_12px_rgba(0,113,227,0.2)] hover:shadow-[0_6px_20px_rgba(0,113,227,0.3)] transition-all duration-300 flex items-center justify-center space-x-2 cursor-pointer ${
                  isFormSubmitting || cart.length === 0
                    ? 'bg-apple-gray-dark/50 shadow-none cursor-not-allowed text-apple-gray-dark'
                    : 'bg-apple-blue hover:bg-apple-blue-hover'
                }`}
              >
                {isFormSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>กำลังประมวลผลเซฟประวัติเบิก ({cart.length} ตะกร้า)...</span>
                  </>
                ) : (
                  <>
                    <span>ยืนยันการตั้งเรื่องเบิกอุปกรณ์ออก ({cart.reduce((s, i) => s + i.qty, 0)} ชิ้น) &rarr;</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Available Items selector list (Right) */}
          <div className="lg:col-span-5 flex flex-col space-y-4 lg:self-start animate-fade-in" id="avail-items-picker-col">
            <div className="bg-white p-5 rounded-2xl border border-apple-border shadow-apple-card text-left">
              <h4 className="text-[11px] text-apple-gray-dark font-semibold uppercase tracking-wider mb-3 flex items-center justify-between">
                <span>เลือกคลังอุปกรณ์พร้อมใช้ ({availableEquipments.length} รายการ)</span>
              </h4>
              
              {/* Search input in panel */}
              <div className="relative mb-4">
                <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-apple-gray-dark pointer-events-none" />
                <input
                  type="text"
                  placeholder="ค้นหารหัส หรือชื่อพัสดุ..."
                  value={searchTermEq}
                  onChange={(e) => setSearchTermEq(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-apple-border bg-apple-gray rounded-xl text-xs focus:outline-none"
                />
              </div>

              {/* Category Filter Buttons */}
              <div className="mb-4 space-y-2 shrink-0">
                <span className="text-[10px] font-bold text-apple-gray-dark uppercase tracking-wider block">กรองด่วนตามหมวดหมู่:</span>
                <div className="flex flex-nowrap overflow-x-auto gap-1.5 pb-2 -mx-1 px-1 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:bg-[#E8E8ED] [&::-webkit-scrollbar-thumb]:rounded-full">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('')}
                    className={`text-[10px] px-3.5 py-1.5 rounded-full border-0 transition-all duration-300 cursor-pointer shrink-0 whitespace-nowrap ${
                      !selectedCategory
                        ? 'bg-apple-dark text-white font-semibold shadow-xs'
                        : 'bg-apple-gray text-apple-gray-dark hover:bg-[#E8E8ED] hover:text-apple-dark font-semibold'
                    }`}
                  >
                    ทั้งหมด
                  </button>
                  {Array.from(new Set(equipments.map(item => item.category))).filter(Boolean).map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`text-[10px] px-3.5 py-1.5 rounded-full border-0 transition-all duration-300 cursor-pointer shrink-0 whitespace-nowrap ${
                        selectedCategory === cat
                          ? 'bg-apple-dark text-white font-semibold shadow-xs'
                          : 'bg-apple-gray text-apple-gray-dark hover:bg-[#E8E8ED] hover:text-apple-dark font-semibold'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Selector and Multiplier panel */}
              {selectedEqId && (
                <div className="mb-4 bg-apple-blue-bg border border-apple-blue/20 p-4 rounded-xl flex flex-col space-y-3.5 animate-in slide-in-from-top-3 duration-250">
                  <div className="flex items-center space-x-3">
                    <img 
                      src={equipments.find(x => x.id === selectedEqId)?.image_url} 
                      alt="Selected" 
                      className="w-10 h-10 object-contain bg-white rounded-lg border border-apple-border shrink-0"
                    />
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-xs font-bold text-apple-dark truncate">{equipments.find(x => x.id === selectedEqId)?.name}</p>
                      <p className="text-[10px] text-apple-gray-dark">ว่างจำหน่าย: {equipments.find(x => x.id === selectedEqId)?.available_qty ?? 1} ชิ้น</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-apple-blue/10">
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => setBorrowQty(p => Math.max(1, p - 1))}
                        className="w-8 h-8 bg-white hover:bg-apple-gray border border-apple-border text-apple-dark font-bold rounded-lg flex items-center justify-center text-sm cursor-pointer select-none transition-all"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={equipments.find(x => x.id === selectedEqId)?.available_qty ?? 1}
                        value={borrowQty}
                        onChange={(e) => setBorrowQty(Math.max(1, Math.min(equipments.find(x => x.id === selectedEqId)?.available_qty ?? 1, Number(e.target.value))))}
                        className="qty-input w-10 h-8 border border-apple-border rounded-lg text-xs bg-white text-center font-bold focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setBorrowQty(p => Math.min(equipments.find(x => x.id === selectedEqId)?.available_qty ?? 1, p + 1))}
                        className="w-8 h-8 bg-white hover:bg-apple-gray border border-apple-border text-apple-dark font-bold rounded-lg flex items-center justify-center text-sm cursor-pointer select-none transition-all"
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const eq = equipments.find(x => x.id === selectedEqId);
                        if (eq) addToCart(eq, borrowQty);
                      }}
                      className="bg-apple-blue hover:bg-apple-blue-hover text-white text-[11px] font-semibold px-4 py-2 rounded-xl transition-all duration-300 flex items-center space-x-1.5 cursor-pointer shadow-[0_4px_12px_rgba(0,113,227,0.15)]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>เพิ่มเข้าตะกร้าเบิก 🛒</span>
                    </button>
                  </div>
                </div>
              )}

              {/* List items scroll */}
              <div className="space-y-2 overflow-y-auto max-h-[520px] pr-1">
                {availableEquipments.length === 0 ? (
                  <div className="text-center py-12 text-xs text-apple-gray-dark font-medium">
                    ไม่มีพัสดุว่างพร้อมให้ยืมตามคำค้นหานี้
                  </div>
                ) : (
                  availableEquipments.map(item => {
                    const isInCart = cart.some(i => i.equipment.id === item.id);
                    const isSecSelected = selectedEqId === item.id;
                    const itemsInCartCount = cart.find(i => i.equipment.id === item.id)?.qty || 0;
                    
                    return (
                      <div 
                        key={item.id}
                        onClick={() => setSelectedEqId(item.id)}
                        className={`p-3 border rounded-xl flex items-center justify-between gap-3 cursor-pointer transition select-none text-left duration-200 ${
                          isSecSelected
                            ? 'bg-apple-blue-bg border-apple-blue shadow-xs scale-[1.01] hover:bg-[#E8F2FF]/80'
                            : isInCart
                              ? 'bg-apple-gray/50 border-apple-border opacity-95 hover:bg-apple-gray'
                              : 'bg-white hover:bg-apple-gray border-apple-border'
                        }`}
                      >
                        <img 
                          src={item.image_url} 
                          alt={item.name} 
                          className="w-10 h-10 object-contain rounded-lg shrink-0 border border-apple-border p-1 bg-white"
                          referrerPolicy="no-referrer"
                        />
                        <div className="flex-1 min-w-0">
                          <h5 className="text-xs font-bold text-apple-dark truncate leading-snug">{item.name}</h5>
                          <p className="text-[10px] text-apple-gray-dark mt-1 flex items-center gap-1.5">
                            <span className="font-mono bg-apple-gray text-apple-dark px-1.5 py-0.5 rounded font-bold">{item.code}</span>
                            <span className="truncate">{item.category}</span>
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-[10px] text-apple-dark font-semibold">
                            มี {item.available_qty ?? 1} ชิ้น
                          </span>
                          {isInCart && (
                            <span className="text-[9px] font-sans font-bold bg-[#EAF9EE] text-apple-success px-2 py-0.5 rounded-full line-clamp-1">
                              ในตะกร้า: {itemsInCartCount} ชิ้น
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* --- RETURN LIST TAB --- */
        <div className="space-y-6" id="return-layout-root">
          {/* Search and Date Filter Box */}
          <div className="bg-white p-6 rounded-2xl border border-[#E8E8ED] shadow-apple-card space-y-5 text-left" id="return-search-and-filters">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4" id="return-search-inputs-grid">
              
              {/* Text Search Control (4 cols) */}
              <div className="lg:col-span-4 relative" id="return-text-search-container">
                <label className="block text-[11px] font-sans text-slate-500 font-bold uppercase tracking-wider mb-1.5">คำค้นหาอุปกรณ์หรือรายชื่อ</label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="ระบุชื่อผู้ยืม, แผนก, รหัสพัสดุ..."
                    value={searchTermReturn}
                    onChange={(e) => setSearchTermReturn(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-[#E8E8ED] rounded-xl text-xs font-sans focus:outline-hidden focus:border-apple-primary focus:ring-1 focus:ring-apple-primary/20 bg-[#F5F5F7]/60 transition-all"
                  />
                </div>
              </div>

              {/* Date Filter Type Selection (4 cols) */}
              <div className="lg:col-span-4" id="return-date-type-container">
                <label className="block text-[11px] font-sans text-slate-500 font-bold uppercase tracking-wider mb-1.5">ประเภทวันที่ตรวจสอบ</label>
                <select
                  value={returnFilterDateType}
                  onChange={(e) => setReturnFilterDateType(e.target.value as 'borrow' | 'due')}
                  className="w-full px-3.5 py-2 border border-[#E8E8ED] rounded-xl text-xs font-sans focus:outline-hidden focus:border-apple-primary focus:ring-1 focus:ring-apple-primary/20 bg-white transition-all appearance-none cursor-pointer relative"
                  style={{
                    backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236B7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                    backgroundPosition: 'right 0.8rem center',
                    backgroundSize: '1.25rem 1.25rem',
                    backgroundRepeat: 'no-repeat',
                    paddingRight: '2.5rem'
                  }}
                >
                  <option value="due">📅 วันกำหนดส่งคืนพัสดุ</option>
                  <option value="borrow">📤 วันที่ทำเรื่องเบิกยืม</option>
                </select>
              </div>

              {/* Start Date (2 cols) */}
              <div className="lg:col-span-2" id="return-start-date-container">
                <label className="block text-[11px] font-sans text-slate-500 font-bold uppercase tracking-wider mb-1.5">ตั้งแต่วันที่</label>
                <input
                  type="date"
                  value={returnFilterStartDate}
                  onChange={(e) => setReturnFilterStartDate(e.target.value)}
                  className="w-full px-3.5 py-2 border border-[#E8E8ED] rounded-xl text-xs font-sans focus:outline-hidden focus:border-apple-primary focus:ring-1 focus:ring-apple-primary/20 bg-white transition-all"
                />
              </div>

              {/* End Date (2 cols) */}
              <div className="lg:col-span-2" id="return-end-date-container">
                <label className="block text-[11px] font-sans text-slate-500 font-bold uppercase tracking-wider mb-1.5">ถึงวันที่</label>
                <input
                  type="date"
                  value={returnFilterEndDate}
                  onChange={(e) => setReturnFilterEndDate(e.target.value)}
                  className="w-full px-3.5 py-2 border border-[#E8E8ED] rounded-xl text-xs font-sans focus:outline-hidden focus:border-apple-primary focus:ring-1 focus:ring-apple-primary/20 bg-white transition-all"
                />
              </div>

            </div>

            {/* Quick Filter Buttons & Summary */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 border-t border-[#E8E8ED]" id="return-quick-filters">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 font-sans uppercase mr-1">กรองด่วน:</span>
                
                {/* Overdue fast filter */}
                <button
                  type="button"
                  onClick={() => {
                    setReturnFilterDateType('due');
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    setReturnFilterStartDate('');
                    setReturnFilterEndDate(yesterday.toISOString().split('T')[0]);
                  }}
                  className={`text-[10.5px] px-3.5 py-1.5 rounded-full font-semibold font-sans transition-all duration-200 cursor-pointer border ${
                    !returnFilterStartDate && returnFilterEndDate && returnFilterEndDate < new Date().toISOString().split('T')[0]
                      ? 'bg-rose-500 border-rose-500 text-white shadow-xs'
                      : 'bg-rose-50/60 border-rose-100/80 text-rose-700 hover:bg-rose-100/80'
                  }`}
                >
                  🚨 เลยกำหนดส่งคืนแล้ว
                </button>

                {/* Due Today fast filter */}
                <button
                  type="button"
                  onClick={() => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    setReturnFilterDateType('due');
                    setReturnFilterStartDate(todayStr);
                    setReturnFilterEndDate(todayStr);
                  }}
                  className={`text-[10.5px] px-3.5 py-1.5 rounded-full font-semibold font-sans transition-all duration-200 cursor-pointer border ${
                    returnFilterStartDate === new Date().toISOString().split('T')[0] && returnFilterEndDate === new Date().toISOString().split('T')[0]
                      ? 'bg-amber-500 border-amber-500 text-white shadow-xs'
                      : 'bg-[#FFF9E6] border-amber-250/30 text-[#8F6B00] hover:bg-amber-100/60'
                  }`}
                >
                  ⏳ ต้องคืนวันนี้
                </button>

                {/* Due this week fast filter */}
                <button
                  type="button"
                  onClick={() => {
                    setReturnFilterDateType('due');
                    const today = new Date();
                    const nextWeek = new Date();
                    nextWeek.setDate(nextWeek.getDate() + 7);
                    setReturnFilterStartDate(today.toISOString().split('T')[0]);
                    setReturnFilterEndDate(nextWeek.toISOString().split('T')[0]);
                  }}
                  className={`text-[10.5px] px-3.5 py-1.5 rounded-full font-semibold font-sans transition-all duration-200 cursor-pointer border ${
                    returnFilterStartDate === new Date().toISOString().split('T')[0] && returnFilterEndDate && returnFilterEndDate > new Date().toISOString().split('T')[0]
                      ? 'bg-apple-primary border-apple-primary text-white shadow-xs'
                      : 'bg-blue-50/60 border-blue-105/50 text-blue-700 hover:bg-blue-100/60'
                  }`}
                >
                  📅 ภายใน 7 วันนี้
                </button>

                {/* Reset button if filter is active */}
                {(returnFilterStartDate || returnFilterEndDate || searchTermReturn) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTermReturn('');
                      setReturnFilterStartDate('');
                      setReturnFilterEndDate('');
                    }}
                    className="text-[10.5px] px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200/80 border border-[#E8E8ED] text-slate-600 rounded-full font-semibold font-sans transition-all duration-200 cursor-pointer"
                  >
                    ล้างตัวกรองทั้งหมด ✕
                  </button>
                )}
              </div>

              {/* Metrics show how many transactions found */}
              <span className="text-[11px] text-slate-400 font-sans font-medium">
                พบพัสดุค้างคืนตรงตามเงื่อนไข <span className="font-bold text-slate-700 font-mono">{activeBorrows.length}</span> รายการ
              </span>
            </div>
          </div>

          {/* List items cards */}
          {activeBorrows.length === 0 ? (
            <div className="bg-white rounded-2xl p-16 text-center border border-[#E8E8ED] shadow-apple-card">
              <CheckCircle className="h-10 w-10 text-apple-success mx-auto mb-3 animate-pulse" />
              <h4 className="text-sm font-bold font-sans text-slate-800 tracking-wide">ไม่มีอุปกรณ์ที่กำลังเบิกยืมอยู่</h4>
              <p className="text-xs text-slate-450 font-sans mt-1">อุปกรณ์ทุกชิ้นถูกส่งคืนถูกต้องเรียบร้อยครบถ้วนทั้งหมดแล้วค่ะ!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" id="return-items-grid">
              {activeBorrows.map(tx => {
                const isOverdue = tx.status === 'overdue';
                const daysDiff = Math.ceil((new Date(tx.due_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                
                return (
                  <div 
                    key={tx.id}
                    className={`bg-white border overflow-hidden shadow-apple-card hover:shadow-lg hover:-translate-y-0.5 transition-all duration-305 flex flex-col justify-between text-left rounded-2xl ${
                      isOverdue ? 'border-rose-200/80 ring-1 ring-rose-100/50' : 'border-[#E8E8ED]'
                    }`}
                  >
                    {/* Header bar showing borrower name */}
                    <div className={`px-4.5 py-3 shrink-0 flex justify-between items-center ${
                      isOverdue ? 'bg-rose-50/40 border-b border-rose-100/50' : 'bg-[#F5F5F7] border-b border-[#E8E8ED]'
                    }`}>
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-xl shrink-0 ${
                          isOverdue ? 'bg-rose-100 text-rose-700' : 'bg-blue-50 text-blue-700'
                        }`}>
                          <User className="h-4 w-4" />
                        </div>
                        <div className="text-left min-w-0">
                          <p className="text-xs font-bold font-sans text-slate-800 leading-tight truncate">{tx.borrower_name}</p>
                          <p className="text-[10px] text-slate-500 font-sans truncate max-w-32">{tx.borrower_department}</p>
                        </div>
                      </div>
                      
                      <span className={`px-2.5 py-1 text-[9.5px] font-sans font-bold rounded-full ${
                        isOverdue 
                          ? 'bg-rose-50 text-rose-700 border-rose-100 border'
                          : 'bg-blue-50 text-blue-700 border border-blue-100'
                      }`}>
                        {isOverdue ? 'เลยกำหนดส่ง' : `เหลือ ${daysDiff} วัน`}
                      </span>
                    </div>

                    {/* Equipment Description */}
                    <div className="p-4.5 flex-1 space-y-3 flex flex-col justify-between">
                      <div className="space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-mono bg-[#F5F5F7] text-slate-650 font-bold px-2 py-0.5 rounded-md text-[9px] border border-[#E8E8ED]">
                            {tx.equipment_code}
                          </span>
                          {/* Compact borrow quantity indicator */}
                          <div className="bg-slate-900 text-white rounded-lg px-2 py-0.5 text-[10px] font-mono shrink-0 whitespace-nowrap font-semibold">
                            เบิก: {tx.borrow_qty ?? 1} ชิ้น
                          </div>
                        </div>
                        <h4 className="text-xs font-bold font-sans text-slate-800 line-clamp-1">{tx.equipment_name}</h4>
                      </div>

                      {tx.purpose && (
                        <p className="text-[10px] text-slate-500 border-l-2 border-apple-primary/45 pl-2 leading-relaxed min-h-[16px] line-clamp-2">
                          วัตถุประสงค์: "{tx.purpose}"
                        </p>
                      )}

                      {tx.evidence_image_url && (
                        <div className="bg-blue-50/30 border border-blue-100/50 p-2 rounded-xl flex items-center justify-between gap-2">
                          <span className="text-[9px] font-bold text-slate-650 font-sans flex items-center gap-1.5 min-w-0">
                            <Camera className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span className="truncate">ภาพหลักฐานเสนอเบิก</span>
                          </span>
                          <button 
                            type="button"
                            onClick={() => setActiveLightboxUrl(tx.evidence_image_url)}
                            className="text-[9px] font-bold text-apple-primary hover:underline shrink-0 font-sans cursor-pointer whitespace-nowrap bg-transparent border-0 active:scale-95 transition-all"
                          >
                            เปิดดูรูปถ่าย &rarr;
                          </button>
                        </div>
                      )}

                      <div className="text-[10px] font-sans text-slate-450 flex flex-col space-y-1 pt-2.5 border-t border-[#E8E8ED]">
                        <p>ยืมเมื่อ: <span className="font-mono font-semibold text-slate-600">{new Date(tx.borrow_date).toLocaleDateString('th-TH')}</span></p>
                        <p className={isOverdue ? 'text-rose-500 font-bold' : ''}>
                          กำหนดคืน: <span className="font-mono">{new Date(tx.due_date).toLocaleDateString('th-TH')}</span>
                        </p>
                      </div>
                    </div>

                    {/* Operation button */}
                    <div className="p-3 bg-[#F5F5F7]/40 border-t border-[#E8E8ED] shrink-0">
                      <button
                        onClick={() => openReturnDialog(tx)}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-bold font-sans transition-all flex items-center justify-center space-x-1.5 cursor-pointer active:scale-98 ${
                          isOverdue 
                            ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-md shadow-rose-500/10' 
                            : 'bg-apple-primary hover:bg-[#0077ED] text-white shadow-md shadow-apple-primary/10'
                        }`}
                      >
                        <ArrowDownLeft className="h-4 w-4" />
                        <span>ส่งเรื่องคืนอุปกรณ์</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Return Confirmation Modal dialog */}
      {isReturnModalOpen && selectedTxForReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden" id="return-modal-root">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md transition-opacity" onClick={() => setIsReturnModalOpen(false)} />
          
          <div className="bg-white rounded-3xl w-full max-w-md mx-4 overflow-hidden shadow-2xl z-10 text-left border border-[#E8E8ED] animate-in fade-in-50 zoom-in-95 duration-200">
            {/* Modal title */}
            <div className="px-6 py-4 border-b border-[#E8E8ED] flex items-center justify-between shrink-0">
              <h3 className="text-sm font-bold font-sans text-slate-900 flex items-center gap-2">
                <ArrowDownLeft className="h-4 w-4 text-apple-primary" /> บันทึกการส่งมอบคืนคลัง
              </h3>
              <button 
                onClick={() => setIsReturnModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-650 hover:bg-[#F5F5F7] rounded-full transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal content */}
            <form onSubmit={handleReturnSubmit} className="p-6 space-y-4">
              {returnError && (
                <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-xs text-rose-700 flex items-start gap-2 font-sans">
                  <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{returnError}</span>
                </div>
              )}
              {returnSuccess && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-700 flex items-start gap-2 font-sans animate-pulse">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>{returnSuccess}</span>
                </div>
              )}

              {/* summary info of borrowed */}
              <div className="bg-blue-50/30 p-4 rounded-2xl border border-blue-100/30 flex items-start space-x-3.5 text-left">
                <div className="bg-blue-50 text-blue-700 p-2.5 rounded-xl shrink-0 mt-0.5">
                  <Tag className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-slate-800 leading-snug truncate">{selectedTxForReturn.equipment_name}</h4>
                  <p className="text-[10.5px] text-slate-500 mt-1">
                    รหัส: <span className="font-mono font-bold text-slate-700">{selectedTxForReturn.equipment_code}</span>
                  </p>
                  <p className="text-[10.5px] text-slate-500 mt-0.5">
                    ผู้เบิก: <span className="font-semibold text-blue-900">{selectedTxForReturn.borrower_name}</span> · {selectedTxForReturn.borrower_department}
                  </p>
                </div>
              </div>

              {/* Input condition text */}
              <div>
                <label className="block text-[11px] font-sans text-slate-500 font-bold uppercase tracking-wider mb-1.5">สภาพอุปกรณ์ตอนคืน *</label>
                <input
                  type="text"
                  required
                  value={conditionOnReturn}
                  onChange={(e) => setConditionOnReturn(e.target.value)}
                  className="w-full px-3.5 py-2 border border-[#E8E8ED] rounded-xl text-xs font-sans focus:outline-hidden focus:border-apple-primary focus:ring-1 focus:ring-apple-primary/20 bg-[#F5F5F7]/50 focus:bg-white transition-all"
                  placeholder="เช่น ปกติดี เรียบร้อยดี หรือตรวจพบคราบปัดฝุ่นเล็กน้อย"
                />
              </div>

              {/* Select future equipment status */}
              <div>
                <label className="block text-[11px] font-sans text-slate-500 font-bold uppercase tracking-wider mb-1.5">อัปเดตสถานะของอุปกรณ์ต่อจากนี้ *</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: 'available', name: 'ปกติพร้อมแจกยืม', color: 'border-[#E8E8ED] hover:bg-[#EAF9EE]/50 text-slate-650 hover:text-emerald-700', active: 'bg-[#34C759] border-[#34C759] text-white' },
                    { val: 'maintenance', name: 'ต้องส่งซ่อม', color: 'border-[#E8E8ED] hover:bg-amber-50/50 text-slate-650 hover:text-amber-700', active: 'bg-amber-500 border-amber-500 text-white' },
                    { val: 'broken', name: 'ชำรุดเสียหาย', color: 'border-[#E8E8ED] hover:bg-rose-50/50 text-slate-655 hover:text-rose-700', active: 'bg-rose-500 border-rose-500 text-white' },
                  ].map(spec => (
                    <button
                      key={spec.val}
                      type="button"
                      onClick={() => setItemConditionStatus(spec.val as any)}
                      className={`py-2 px-1 text-[10.5px] font-sans font-bold border rounded-xl transition-all duration-200 cursor-pointer active:scale-95 ${
                        itemConditionStatus === spec.val ? spec.active : `${spec.color} bg-white`
                      }`}
                    >
                      {spec.name}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-2 font-sans leading-relaxed">
                  สภาพอุปกรณ์ชิ้นนี้จะถูกอัปเดตคืนสู่คลังและปรับสิทธิสถานะเบิกจ่ายจริงทันที
                </p>
              </div>

              {/* Modal footer operations */}
              <div className="pt-4 border-t border-[#E8E8ED] flex items-center justify-end space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsReturnModalOpen(false)}
                  className="px-4 py-2 border border-[#E8E8ED] rounded-xl text-xs font-sans font-semibold hover:bg-[#F5F5F7] text-slate-650 transition-all cursor-pointer active:scale-98"
                >
                  ปิดหน้าต่าง
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-apple-primary hover:bg-[#0077ED] text-white font-sans font-semibold text-xs rounded-xl shadow-md shadow-apple-primary/10 hover:shadow-lg hover:shadow-apple-primary/20 transition-all cursor-pointer active:scale-98"
                >
                  ยืนยันการรับของคืนพัสดุ
                </button>
              </div>
            </form>
          </div>
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
              <Camera className="w-4 h-4 text-blue-650" />
              <span>ภาพหลักฐานใบเบิกคลังอุปกรณ์ (Cyfence Inventory Evidence Image)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
