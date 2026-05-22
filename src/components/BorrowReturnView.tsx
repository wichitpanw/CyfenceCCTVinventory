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
    <div className="space-y-4" id="borrow-return-root">
      {/* Top bar & Sub-nav */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-3" id="borrow-return-header">
        <div>
          <h2 className="text-lg font-bold font-sans text-slate-800">กระดานเบิก - คืน พัสดุ</h2>
          <p className="text-xs text-slate-400 font-sans">ลงทะเบียนรับเข้าของออก ยืมไปใช้งาน และสแกนส่งมอบพัสดุคืนคลัง</p>
        </div>

        {/* Local pill switcher */}
        <div className="bg-slate-105 p-0.5 rounded flex items-center shrink-0 border border-slate-205" id="tab-switcher">
          <button
            onClick={() => { setActiveSubTab('borrow'); onRefresh(); }}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-sans font-bold transition-all cursor-pointer ${
              activeSubTab === 'borrow' 
                ? 'bg-white text-blue-700 shadow-3xs' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            <span>ทำรายการเบิกอุปกรณ์</span>
          </button>
          <button
            onClick={() => { setActiveSubTab('return'); onRefresh(); }}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-sans font-bold transition-all cursor-pointer ${
              activeSubTab === 'return' 
                ? 'bg-white text-blue-700 shadow-3xs' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <ArrowDownLeft className="h-3.5 w-3.5" />
            <span>รายการส่งมอบคืนคลัง</span>
            {transactions.filter(x => x.status === 'borrowing' || x.status === 'overdue').length > 0 && (
              <span className="text-[10px] bg-blue-100 text-blue-700 font-extrabold px-1.5 rounded h-4 min-w-[16px] flex items-center justify-center animate-pulse">
                {transactions.filter(x => x.status === 'borrowing' || x.status === 'overdue').length}
              </span>
            )}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
          <p className="text-slate-500 font-sans text-xs">กำลังประมวลยอดคัดแยก...</p>
        </div>
      ) : activeSubTab === 'borrow' ? (
        /* --- BORROW FORM TAB --- */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5" id="borrow-layout-grid">
          {/* Borrow Inputs Form (Left) */}
          <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-slate-250 shadow-xs text-left" id="borrow-form-col">
            <h3 className="text-xs font-bold text-slate-700 border-b border-slate-150 pb-2.5 mb-4 flex items-center gap-2 uppercase tracking-wider">
              <ShoppingCart className="h-4 w-4 text-blue-600" /> ระบุรายละเอียดและสรุปตะกร้าอุปกรณ์เสนอเบิก
            </h3>

            <form onSubmit={handleBorrowSubmit} className="space-y-4">
              {borrowError && (
                <div className="bg-rose-50 border border-rose-100 text-rose-700 p-3 rounded-lg text-xs flex items-start gap-2 font-sans animate-fade-in">
                  <AlertCircle className="h-4 w-4 text-rose-550 shrink-0 mt-0.5" />
                  <span>{borrowError}</span>
                </div>
              )}
              {borrowSuccess && (
                <div className="bg-emerald-50 border border-emerald-100 text-emerald-850 p-3 rounded-lg text-xs flex items-start gap-2 font-sans animate-pulse">
                  <CheckCircle className="h-4 w-4 text-emerald-650 shrink-0 mt-0.5" />
                  <span>{borrowSuccess}</span>
                </div>
              )}

              {/* Step 1: Cart Items List */}
              <div className="space-y-2">
                <label className="block text-[10px] font-sans text-slate-500 font-bold uppercase tracking-wider">
                  1. รายการอุปกรณ์ที่จะเบิกในรอบนี้ * ({cart.length} ชนิด)
                </label>
                
                {cart.length === 0 ? (
                  <div className="bg-slate-50 border border-dashed border-slate-250 p-6 text-center rounded-xl">
                    <ShoppingCart className="h-7 w-7 text-slate-350 mx-auto mb-2 opacity-60" />
                    <p className="text-xs text-slate-500 font-medium">ยังไม่มีรายการเสนอเบิกในตะกร้าค่ะ</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      กรุณาเลือกอุปกรณ์จากแผงด้านขวามือระบุจำนวน แล้วกดปุ่ม <span className="font-bold text-blue-600">"เพิ่มเข้าตะกร้าเบิก 🛒"</span>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 border border-slate-200/80 rounded-xl p-3 bg-slate-50/50 max-h-72 overflow-y-auto">
                    {cart.map((item, idx) => (
                      <div 
                        key={item.equipment.id} 
                        className="bg-white border border-slate-200 p-2.5 rounded-lg flex items-center justify-between gap-3 text-left shadow-3xs"
                      >
                        <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                          <img 
                            src={item.equipment.image_url} 
                            alt="E" 
                            className="w-9 h-9 object-contain bg-slate-50 p-1 rounded-md shrink-0 border border-slate-150"
                            referrerPolicy="no-referrer"
                          />
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-bold text-slate-800 truncate leading-snug">
                              {item.equipment.name}
                            </h4>
                            <p className="text-[9px] text-slate-400 truncate">
                              รหัส: <span className="font-mono font-bold text-slate-650">{item.equipment.code}</span> · ว่างเหลือ {item.equipment.available_qty ?? 1} ชิ้น
                            </p>
                          </div>
                        </div>

                        {/* Qty Manager & Delete buttons */}
                        <div className="flex items-center space-x-3 shrink-0">
                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => updateCartQty(idx, item.qty - 1)}
                              className="w-6 h-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded flex items-center justify-center text-xs transition cursor-pointer"
                            >
                              -
                            </button>
                            <span className="w-8 text-center text-xs font-bold text-slate-800">{item.qty}</span>
                            <button
                              type="button"
                              onClick={() => updateCartQty(idx, item.qty + 1)}
                              className="w-6 h-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded flex items-center justify-center text-xs transition cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => removeFromCart(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition cursor-pointer"
                            title="ลบออกจากใบเบิก"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    
                    <div className="flex justify-between items-center pt-2 px-1 text-slate-500 text-[10px] font-bold uppercase tracking-wider border-t border-slate-200">
                      <span>รวมรายการพัสดุ: {cart.length} ชนิด</span>
                      <span className="text-blue-600 font-extrabold">จำนวนรวมทั้งสิ้น: {cart.reduce((s, i) => s + i.qty, 0)} ชิ้น</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Borrower profile */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[10px] font-sans text-slate-500 font-bold uppercase tracking-wider mb-1">2. ชื่อ-นามสกุล ผู้เสนอเบิก *</label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={borrowerName}
                      onChange={(e) => setBorrowerName(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 border border-slate-250 rounded-lg text-xs font-sans focus:outline-hidden"
                      placeholder="เช่น สมศักดิ์ แสนดี"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-sans text-slate-500 font-bold uppercase tracking-wider mb-1">3. บริษัทผู้ยืม *</label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <select
                      value={borrowerDepartment}
                      onChange={(e) => setBorrowerDepartment(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 border border-slate-250 rounded-lg text-xs font-sans focus:outline-hidden bg-white"
                    >
                      {COMPANIES.map(company => (
                        <option key={company} value={company}>{company}</option>
                      ))}
                    </select>
                  </div>
                  {borrowerDepartment === 'อื่นๆ ระบุ' && (
                    <div className="mt-2 animate-in fade-in-50 duration-200">
                      <label className="block text-[9px] font-sans text-indigo-600 font-semibold uppercase tracking-wider mb-1">ระบุชื่อบริษัทอื่นๆ *</label>
                      <input
                        type="text"
                        value={customCompany}
                        onChange={(e) => setCustomCompany(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-sans focus:outline-hidden bg-white"
                        placeholder="ระบุบริษัทของคุณ..."
                        required
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Step 3: Dates pick */}
              <div>
                <label className="block text-[10px] font-sans text-slate-500 font-bold uppercase tracking-wider mb-1">4. กำหนดวันส่งมอบคืนพัสดุ *</label>
                <div className="relative mb-2">
                  <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="date"
                    value={dueDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 border border-slate-250 rounded-lg text-xs font-sans focus:outline-hidden"
                    required
                  />
                </div>
                {/* Fast selectors */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-400">ระยะยืมแนะนำ:</span>
                  {[3, 5, 7, 14].map(days => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => handleSetQuickDays(days)}
                      className="text-[10px] font-sans py-0.5 px-2 bg-slate-50 border border-slate-200 rounded text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                    >
                      {days} วัน
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 4: Purpose */}
              <div>
                <label className="block text-[10px] font-sans text-slate-500 font-bold uppercase tracking-wider mb-1">5. วัตถุประสงค์ในการเบิกใช้พัสดุ</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <textarea
                    rows={2}
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 border border-slate-250 rounded-lg text-xs font-sans focus:outline-hidden animate-none"
                    placeholder="เช่น ใช้จัดทำไลฟ์ประชุม, ติดหน้างานนอกสถานที่"
                  />
                </div>
              </div>

              {/* Step 6: Evidence image uploads for audit files */}
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
                  <div>
                    <label className="block text-[10px] font-sans text-slate-700 font-bold uppercase tracking-wider">
                      6. รูปประกอบหลักฐาน
                    </label>
                    <p className="text-[9px] text-slate-400 font-sans">ถ่ายหรือเก็บเป็นไฟล์ภาพประกอบการเบิกเพื่อความโปร่งใส</p>
                  </div>
                  
                  {/* Image source pill */}
                  <div className="bg-slate-200/60 p-0.5 rounded-lg flex items-center inline-flex self-start text-[10px] border border-slate-250 font-bold">
                    <button
                      type="button"
                      onClick={() => { setEvidenceSourceMode('upload'); setEvidenceImage(''); }}
                      className={`px-2 py-0.5 rounded font-sans ${evidenceSourceMode === 'upload' ? 'bg-white text-slate-800' : 'text-slate-500'}`}
                    >
                      อัปโหลดรูป
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEvidenceSourceMode('url'); setEvidenceImage(''); }}
                      className={`px-2 py-0.5 rounded font-sans ${evidenceSourceMode === 'url' ? 'bg-white text-slate-800' : 'text-slate-500'}`}
                    >
                      แนบลิงก์ URL
                    </button>
                  </div>
                </div>

                {evidenceSourceMode === 'upload' ? (
                  <div className="space-y-2.5">
                    {evidenceImage ? (
                      <div className="flex flex-col items-center justify-center p-2 border border-slate-200 rounded-lg bg-white relative">
                        <div className="relative w-36 h-28 border border-slate-200 bg-slate-50 rounded-lg overflow-hidden flex items-center justify-center">
                          <img 
                            src={evidenceImage} 
                            alt="Evidence visual" 
                            className="w-full h-full object-contain p-1"
                          />
                          <button
                            type="button"
                            onClick={() => setEvidenceImage('')}
                            className="absolute top-1.5 right-1.5 p-1 bg-black/60 hover:bg-black/80 rounded-full text-white transition cursor-pointer"
                            title="ลบรูปหลักฐาน"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <span className="text-[9px] font-mono text-slate-400 mt-1.5">หลักฐานถูกเข้ารหัส Base64 สำเร็จ</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-slate-200 border-dashed rounded-lg cursor-pointer bg-white hover:bg-slate-50 transition">
                          <div className="flex flex-col items-center justify-center pt-3 pb-3">
                            <UploadCloud className="w-6 h-6 mb-1 text-slate-400" />
                            <p className="mb-0.5 text-[10px] text-slate-500 font-bold">คลิกที่นี่ หรือถ่ายรูปผู้รับพัสดุ</p>
                            <p className="text-[9px] text-slate-400 font-medium">PNG, JPG, WebP (บีบอัดอัตโนมัติ)</p>
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
                  <div className="space-y-2">
                    <input
                      type="url"
                      value={evidenceImage}
                      onChange={(e) => setEvidenceImage(e.target.value)}
                      placeholder="เช่น https://images.unsplash.com/photo-..."
                      className="w-full px-3 py-1.5 border border-slate-250 bg-white rounded-lg text-xs font-sans focus:outline-hidden"
                    />
                    {evidenceImage && (
                      <div className="flex items-center justify-center p-2 border border-slate-200 rounded-lg bg-white">
                        <div className="relative w-36 h-28 border border-slate-200 bg-slate-50 rounded-lg overflow-hidden flex items-center justify-center">
                          <img 
                            src={evidenceImage} 
                            alt="Evidence Preview" 
                            className="w-full h-full object-contain p-1"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1557862921-37829c790f19?w=500&auto=format&fit=crop&q=80';
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setEvidenceImage('')}
                            className="absolute top-1.5 right-1.5 p-1 bg-black/60 hover:bg-black/80 rounded-full text-white transition cursor-pointer"
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
                className={`w-full text-white font-sans font-bold text-xs py-2.5 px-4 rounded-lg shadow-sm transition flex items-center justify-center space-x-2 cursor-pointer ${
                  isFormSubmitting || cart.length === 0
                    ? 'bg-slate-350 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isFormSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
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
          <div className="lg:col-span-5 flex flex-col space-y-4 lg:self-start" id="avail-items-picker-col">
            <div className="bg-white p-4 rounded-xl border border-slate-250 shadow-xs text-left">
              <h4 className="text-[10px] font-bold font-sans text-slate-500 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                <span>เลือกคลังอุปกรณ์พร้อมใช้ ({availableEquipments.length} รายการ)</span>
              </h4>
              
              {/* Search input in panel */}
              <div className="relative mb-3.5">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหารหัส หรือชื่อพัสดุ..."
                  value={searchTermEq}
                  onChange={(e) => setSearchTermEq(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-xs font-sans focus:outline-hidden"
                />
              </div>

              {/* Category Filter Buttons */}
              <div className="mb-3.5 space-y-1.5 shrink-0">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">กรองด่วนตามหมวดหมู่:</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('')}
                    className={`text-[10px] font-sans font-bold px-2.5 py-1 rounded-md border transition cursor-pointer ${
                      !selectedCategory
                        ? 'bg-blue-600 border-blue-600 text-white shadow-3xs'
                        : 'bg-slate-50 border-slate-200 text-slate-650 hover:bg-slate-100'
                    }`}
                  >
                    ทั้งหมด
                  </button>
                  {Array.from(new Set(equipments.map(item => item.category))).filter(Boolean).map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`text-[10px] font-sans font-bold px-2.5 py-1 rounded-md border transition cursor-pointer ${
                        selectedCategory === cat
                          ? 'bg-blue-600 border-blue-600 text-white shadow-3xs'
                          : 'bg-slate-50 border-slate-200 text-slate-650 hover:bg-slate-100'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Selector and Multiplier panel */}
              {selectedEqId && (
                <div className="mb-4 bg-blue-50/75 border border-blue-200 p-3 rounded-lg flex flex-col space-y-2 animate-in slide-in-from-top-3 duration-200">
                  <div className="flex items-center space-x-2">
                    <img 
                      src={equipments.find(x => x.id === selectedEqId)?.image_url} 
                      alt="Selected" 
                      className="w-8 h-8 object-contain bg-white rounded border border-slate-200 shrink-0"
                    />
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-xs font-bold text-slate-800 truncate">{equipments.find(x => x.id === selectedEqId)?.name}</p>
                      <p className="text-[9px] text-slate-400">ว่างจำหน่าย: {equipments.find(x => x.id === selectedEqId)?.available_qty ?? 1} ชิ้น</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => setBorrowQty(p => Math.max(1, p - 1))}
                        className="w-7 h-7 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded flex items-center justify-center text-xs cursor-pointer select-none"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={equipments.find(x => x.id === selectedEqId)?.available_qty ?? 1}
                        value={borrowQty}
                        onChange={(e) => setBorrowQty(Math.max(1, Math.min(equipments.find(x => x.id === selectedEqId)?.available_qty ?? 1, Number(e.target.value))))}
                        className="w-10 h-7 border border-slate-200 rounded text-xs bg-white text-center font-bold font-sans focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={() => setBorrowQty(p => Math.min(equipments.find(x => x.id === selectedEqId)?.available_qty ?? 1, p + 1))}
                        className="w-7 h-7 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded flex items-center justify-center text-xs cursor-pointer select-none"
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
                      className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1 cursor-pointer"
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
                  <div className="text-center py-8 text-xs text-slate-400">
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
                        className={`p-2.5 border rounded-lg flex items-center justify-between gap-3 cursor-pointer transition select-none text-left ${
                          isSecSelected
                            ? 'bg-blue-50 border-blue-400 shadow-2xs'
                            : isInCart
                              ? 'bg-slate-50/70 border-slate-250 opacity-90'
                              : 'bg-white hover:bg-slate-50 border-slate-200'
                        }`}
                      >
                        <img 
                          src={item.image_url} 
                          alt={item.name} 
                          className="w-8 h-8 object-contain rounded shrink-0 border border-slate-200 p-0.5 bg-slate-50"
                          referrerPolicy="no-referrer"
                        />
                        <div className="flex-1 min-w-0">
                          <h5 className="text-xs font-bold text-slate-800 truncate">{item.name}</h5>
                          <p className="text-[9px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                            <span className="font-mono bg-slate-100 text-slate-700 px-1 rounded font-bold">{item.code}</span>
                            <span className="truncate">{item.category}</span>
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-[9px] text-slate-500 font-bold">
                            มี {item.available_qty ?? 1} ชิ้น
                          </span>
                          {isInCart && (
                            <span className="text-[8px] font-sans font-bold bg-emerald-100 text-emerald-850 px-1.5 py-0.5 rounded-full line-clamp-1">
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
        <div className="space-y-4" id="return-layout-root">
          {/* Search and Date Filter Box */}
          <div className="bg-white p-4 rounded-xl border border-slate-200/90 shadow-3xs space-y-3.5 text-left" id="return-search-and-filters">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3" id="return-search-inputs-grid">
              
              {/* Text Search Control (5 cols) */}
              <div className="lg:col-span-4 relative" id="return-text-search-container">
                <label className="block text-[10px] font-sans text-slate-500 font-bold uppercase tracking-wider mb-1">คำค้นหาอุปกรณ์หรือรายชื่อ</label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ระบุชื่อผู้ยืม, แผนก, รหัสพัสดุ..."
                    value={searchTermReturn}
                    onChange={(e) => setSearchTermReturn(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs font-sans focus:outline-hidden focus:border-blue-500 bg-slate-50/50"
                  />
                </div>
              </div>

              {/* Date Filter Type Selection (3 cols) */}
              <div className="lg:col-span-3" id="return-date-type-container">
                <label className="block text-[10px] font-sans text-slate-500 font-bold uppercase tracking-wider mb-1">ประเภทวันที่ตรวจสอบ</label>
                <select
                  value={returnFilterDateType}
                  onChange={(e) => setReturnFilterDateType(e.target.value as 'borrow' | 'due')}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-sans focus:outline-hidden focus:border-blue-500 bg-white"
                >
                  <option value="due">📅 วันกำหนดส่งคืนพัสดุ</option>
                  <option value="borrow">📤 วันที่ทำเรื่องเบิกยืม</option>
                </select>
              </div>

              {/* Start Date (2.5 cols) */}
              <div className="lg:col-span-2.5" id="return-start-date-container">
                <label className="block text-[10px] font-sans text-slate-500 font-bold uppercase tracking-wider mb-1">ตั้งแต่วันที่</label>
                <input
                  type="date"
                  value={returnFilterStartDate}
                  onChange={(e) => setReturnFilterStartDate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-sans focus:outline-hidden focus:border-blue-500 bg-white"
                />
              </div>

              {/* End Date (2.5 cols) */}
              <div className="lg:col-span-2.5" id="return-end-date-container">
                <label className="block text-[10px] font-sans text-slate-500 font-bold uppercase tracking-wider mb-1">ถึงวันที่</label>
                <input
                  type="date"
                  value={returnFilterEndDate}
                  onChange={(e) => setReturnFilterEndDate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-sans focus:outline-hidden focus:border-blue-500 bg-white"
                />
              </div>

            </div>

            {/* Quick Filter Buttons & Summary */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-3 border-t border-slate-100" id="return-quick-filters">
              <div className="flex flex-wrap items-center gap-1.5">
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
                  className={`text-[10px] px-2.5 py-1 rounded-md font-bold font-sans transition cursor-pointer border ${
                    !returnFilterStartDate && returnFilterEndDate && returnFilterEndDate < new Date().toISOString().split('T')[0]
                      ? 'bg-rose-605 border-rose-600 text-white'
                      : 'bg-rose-50 border-rose-100 text-rose-700 hover:bg-rose-100'
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
                  className={`text-[10px] px-2.5 py-1 rounded-md font-bold font-sans transition cursor-pointer border ${
                    returnFilterStartDate === new Date().toISOString().split('T')[0] && returnFilterEndDate === new Date().toISOString().split('T')[0]
                      ? 'bg-amber-600 border-amber-600 text-white'
                      : 'bg-amber-50 border-amber-100 text-amber-700 hover:bg-amber-100'
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
                  className={`text-[10px] px-2.5 py-1 rounded-md font-bold font-sans transition cursor-pointer border ${
                    returnFilterStartDate === new Date().toISOString().split('T')[0] && returnFilterEndDate && returnFilterEndDate > new Date().toISOString().split('T')[0]
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-blue-50 border-blue-100 text-blue-700 hover:bg-blue-100'
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
                    className="text-[10px] px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-705 rounded-md font-bold font-sans transition cursor-pointer"
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
            <div className="bg-white rounded p-12 text-center border border-slate-250 shadow-3xs">
              <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2 animate-bounce" />
              <h4 className="text-xs font-bold font-sans text-slate-600 uppercase tracking-widest">ไม่มีอุปกรณ์ที่กำลังเบิกยืมอยู่</h4>
              <p className="text-[11px] text-slate-400 font-sans mt-0.5">อุปกรณ์ทุกชิ้นถูกส่งคืนถูกต้องสวยงามครบถ้วน ยินดีด้วยครับ!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="return-items-grid">
              {activeBorrows.map(tx => {
                const isOverdue = tx.status === 'overdue';
                const daysDiff = Math.ceil((new Date(tx.due_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                
                return (
                  <div 
                    key={tx.id}
                    className={`bg-white border overflow-hidden shadow-3xs transition flex flex-col justify-between text-left rounded ${
                      isOverdue ? 'border-red-400' : 'border-slate-200'
                    }`}
                  >
                    {/* Header bar showing borrower name */}
                    <div className={`px-3.5 py-2.5 shrink-0 flex justify-between items-center ${
                      isOverdue ? 'bg-red-50' : 'bg-slate-50'
                    }`}>
                      <div className="flex items-center space-x-2.5">
                        <div className={`p-1 rounded shrink-0 ${
                          isOverdue ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-700'
                        }`}>
                          <User className="h-3.5 w-3.5" />
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-bold font-sans text-slate-800 leading-tight">{tx.borrower_name}</p>
                          <p className="text-[10px] text-slate-500 font-sans truncate max-w-32">{tx.borrower_department}</p>
                        </div>
                      </div>
                      
                      <span className={`px-1.5 py-0.5 text-[9px] font-sans font-bold rounded ${
                        isOverdue 
                          ? 'bg-rose-50 text-rose-700 border-rose-100 border'
                          : 'bg-blue-50 text-blue-700 border border-blue-100'
                      }`}>
                        {isOverdue ? 'เลยกำหนดส่ง' : `เหลือ ${daysDiff} วัน`}
                      </span>
                    </div>

                    {/* Equipment Description */}
                    <div className="p-3.5 flex-1 space-y-2.5">
                      <div className="text-left flex justify-between items-start gap-2">
                        <div>
                          <span className="font-mono bg-slate-100 text-slate-700 font-bold px-1 py-0.5 rounded text-[9px]">{tx.equipment_code}</span>
                          <h4 className="text-xs font-bold font-sans text-slate-800 mt-1 line-clamp-1">{tx.equipment_name}</h4>
                        </div>
                        {/* Compact borrow quantity indicator */}
                        <div className="bg-slate-900 text-white rounded px-2 py-1 text-[10px] font-mono shrink-0 whitespace-nowrap font-black">
                          เบิก: {tx.borrow_qty ?? 1} ชิ้น
                        </div>
                      </div>

                      {tx.purpose && (
                        <p className="text-[10px] text-slate-500 border-l-2 border-slate-200 pl-2 leading-relaxed min-h-[16px] line-clamp-2">
                          วัตถุประสงค์: "{tx.purpose}"
                        </p>
                      )}

                      {tx.evidence_image_url && (
                        <div className="bg-blue-50/50 border border-blue-100 p-1.5 px-2.5 rounded-lg flex items-center justify-between gap-2 animate-fade-in">
                          <span className="text-[9px] font-bold text-slate-600 font-sans flex items-center gap-1.5 min-w-0">
                            <Camera className="w-3.5 h-3.5 text-blue-650 shrink-0" />
                            <span className="truncate">ภาพหลักฐานเสนอเบิก</span>
                          </span>
                          <a 
                            href={tx.evidence_image_url} 
                            target="_blank" 
                            rel="noreferrer"
                            className="text-[9px] font-bold text-blue-600 hover:text-blue-700 hover:underline shrink-0 font-sans cursor-pointer whitespace-nowrap"
                          >
                            เปิดดูรูปถ่าย &rarr;
                          </a>
                        </div>
                      )}

                      <div className="text-[10px] font-sans text-slate-400 flex flex-col space-y-1">
                        <p>ยืมเมื่อ: <span className="font-mono font-bold text-slate-600">{new Date(tx.borrow_date).toLocaleDateString('th-TH')}</span></p>
                        <p className={isOverdue ? 'text-red-500 font-bold' : ''}>
                          กำหนดคืน: <span className="font-mono">{new Date(tx.due_date).toLocaleDateString('th-TH')}</span>
                        </p>
                      </div>
                    </div>

                    {/* Operation button */}
                    <div className="p-3 bg-slate-50/50 border-t border-slate-100 shrink-0">
                      <button
                        onClick={() => openReturnDialog(tx)}
                        className={`w-full py-1.5 px-3 rounded text-xs font-bold font-sans transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                          isOverdue 
                            ? 'bg-red-600 hover:bg-red-700 text-white shadow-3xs' 
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
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
          <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-xs transition-opacity" onClick={() => setIsReturnModalOpen(false)} />
          
          <div className="bg-white rounded w-full max-w-sm mx-4 overflow-hidden shadow-2xl z-10 text-left border border-slate-200 animate-in fade-in-50 zoom-in-95 duration-200">
            {/* Modal title */}
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-xs font-bold font-sans uppercase tracking-wider flex items-center gap-1.5">
                  <ArrowDownLeft className="h-4 w-4" /> บันทึกการส่งมอบคืนคลัง
                </h3>
              </div>
              <button 
                onClick={() => setIsReturnModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded transition-all cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal content */}
            <form onSubmit={handleReturnSubmit} className="p-4 space-y-3.5">
              {returnError && (
                <div className="bg-rose-50 border border-rose-105 rounded p-2.5 text-xs text-rose-700 flex items-start gap-1 font-sans">
                  <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{returnError}</span>
                </div>
              )}
              {returnSuccess && (
                <div className="bg-emerald-50 border border-emerald-105 rounded p-2.5 text-xs text-emerald-750 flex items-start gap-1 font-sans animate-pulse">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span>{returnSuccess}</span>
                </div>
              )}

              {/* summary info of borrowed */}
              <div className="bg-blue-50/50 p-3 rounded border border-blue-100 flex items-start space-x-3.5 text-left">
                <div className="bg-blue-105 text-blue-700 p-1.5 rounded shrink-0 mt-0.5">
                  <Tag className="h-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 leading-snug">{selectedTxForReturn.equipment_name}</h4>
                  <p className="text-[10px] text-slate-500 mt-1">
                    รหัส: <span className="font-mono font-bold text-slate-700">{selectedTxForReturn.equipment_code}</span> · ผู้เบิก: <span className="font-semibold text-blue-900">{selectedTxForReturn.borrower_name}</span>
                  </p>
                </div>
              </div>

              {/* Input condition text */}
              <div>
                <label className="block text-[10px] font-sans text-slate-500 font-bold uppercase tracking-wider mb-1">สภาพอุปกรณ์ตอนคืน *</label>
                <input
                  type="text"
                  required
                  value={conditionOnReturn}
                  onChange={(e) => setConditionOnReturn(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded text-xs font-sans focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
                  placeholder="เช่น ปกติดี เรียบร้อยดี หรือตรวจพบคราบปัดฝุ่นเล็กน้อย"
                />
              </div>

              {/* Select future equipment status */}
              <div>
                <label className="block text-[10px] font-sans text-slate-500 font-bold uppercase tracking-wider mb-1">อัปเดตสถานะของอุปกรณ์ต่อจากนี้ *</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: 'available', name: 'ปกติพร้อมแจกยืม', color: 'border-emerald-200 hover:bg-emerald-55 text-emerald-900', active: 'bg-emerald-600 border-emerald-600 text-white' },
                    { val: 'maintenance', name: 'ต้องส่งซ่อม', color: 'border-amber-200 hover:bg-amber-55 text-amber-905', active: 'bg-amber-500 border-amber-500 text-white' },
                    { val: 'broken', name: 'ชำรุดเสียหาย', color: 'border-rose-200 hover:bg-rose-55 text-red-905', active: 'bg-rose-600 border-rose-600 text-white' },
                  ].map(spec => (
                    <button
                      key={spec.val}
                      type="button"
                      onClick={() => setItemConditionStatus(spec.val as any)}
                      className={`py-1.5 px-0.5 text-[10px] font-sans font-bold border rounded transition cursor-pointer ${
                        itemConditionStatus === spec.val ? spec.active : `${spec.color} bg-white`
                      }`}
                    >
                      {spec.name}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-1 font-sans leading-relaxed">
                  สภาพอุปกรณ์ชิ้นนี้จะถูกอัปเดตคืนสู่คลังและปรับสิทธิสถานะเบิกจ่ายจริงทันที
                </p>
              </div>

              {/* Modal footer operations */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsReturnModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded text-xs font-sans font-bold hover:bg-slate-50 text-slate-650 transition cursor-pointer"
                >
                  ปิดหน้าต่าง
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-sans font-bold text-xs rounded shadow-3xs transition cursor-pointer"
                >
                  ยืนยันการรับของคืนพัสดุ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
