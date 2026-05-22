/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit3, 
  Trash2, 
  X, 
  Tag, 
  MapPin, 
  Info, 
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  HelpCircle,
  FileImage
} from 'lucide-react';
import { Equipment, SupabaseConfig } from '../types';
import { getEquipments, addEquipment, updateEquipment, deleteEquipment } from '../services/db';

const CATEGORIES = [
  'กล้องวงจรปิด (CCTV)',
  'เครื่องบันทึกและระบบเก็บข้อมูล',
  'สายสัญญาณและอแดปเตอร์',
  'แหล่งจ่ายไฟและอุปกรณ์สำรอง',
  'ระบบเครือข่ายเน็ตเวิร์ก',
  'คอมพิวเตอร์และอุปกรณ์มอนิเตอร์',
  'เครื่องมือและอุปกรณ์ช่าง',
  'หมวดหมู่อื่นๆ'
];

const STOCK_IMAGES = [
  { name: 'CCTV Camera', url: 'https://images.unsplash.com/photo-1557862921-37829c790f19?w=500&auto=format&fit=crop&q=80' },
  { name: 'NVR/Network Rec', url: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=500&auto=format&fit=crop&q=80' },
  { name: 'Cables & Wiring', url: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=500&auto=format&fit=crop&q=80' },
  { name: 'Power Units', url: 'https://images.unsplash.com/photo-1584286595398-a59f21d313f5?w=500&auto=format&fit=crop&q=80' },
  { name: 'PoE Switches', url: 'https://images.unsplash.com/photo-1530018607912-eff2df114f11?w=500&auto=format&fit=crop&q=80' },
  { name: 'Screens/Monitors', url: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500&auto=format&fit=crop&q=80' }
];

const compressAndConvertToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 500;
        const MAX_HEIGHT = 500;
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
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }
        // Fill white background to handle PNG transparency
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        // Compressed JPEG
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(dataUrl);
      };
      img.onerror = (err) => {
        reject(err);
      };
    };
    reader.onerror = (err) => {
      reject(err);
    };
  });
};

interface InventoryViewProps {
  config: SupabaseConfig;
  refreshTrigger: number;
  onRefresh: () => void;
}

export default function InventoryView({ config, refreshTrigger, onRefresh }: InventoryViewProps) {
  const [items, setItems] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  
  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Delete Confirmation Modal State
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  
  // Form Field State
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<'available' | 'borrowed' | 'maintenance' | 'broken'>('available');
  const [location, setLocation] = useState('');
  const [locationsList, setLocationsList] = useState<string[]>(() => {
    const saved = localStorage.getItem('inventory_locations_list');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {}
    }
    return [
      'อาคารจอดรถชั้น 5 สำนักงานใหญ่',
      'ห้องเก็บของชั้น 3 อาคารศูนย์บริการแจ้งวัฒนะ 2'
    ];
  });
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [newLocationInput, setNewLocationInput] = useState('');

  const saveLocationsList = (newList: string[]) => {
    setLocationsList(newList);
    localStorage.setItem('inventory_locations_list', JSON.stringify(newList));
  };

  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [totalQty, setTotalQty] = useState<number>(1);
  const [availableQty, setAvailableQty] = useState<number>(1);
  const [maintenanceQty, setMaintenanceQty] = useState<number>(0);
  const [brokenQty, setBrokenQty] = useState<number>(0);

  // Drag and Drop & Image source State
  const [imageSourceMode, setImageSourceMode] = useState<'upload' | 'url'>('upload');
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    if (!category && CATEGORIES.length > 0) {
      setCategory(CATEGORIES[0]);
    }
  }, []);

  useEffect(() => {
    async function fetchItems() {
      setLoading(true);
      try {
        const fetched = await getEquipments(config);
        setItems(fetched);
      } catch (err) {
        console.error('Failed to fetch items', err);
      } finally {
        setLoading(false);
      }
    }
    fetchItems();
  }, [config, refreshTrigger]);

  const resetForm = () => {
    setCode(`EQ-2026-${String(items.length + 1).padStart(3, '0')}`);
    setName('');
    setCategory(CATEGORIES[0]);
    setStatus('available');
    setLocation('');
    setDescription('');
    setImageUrl('');
    setTotalQty(1);
    setAvailableQty(1);
    setMaintenanceQty(0);
    setBrokenQty(0);
    setErrorMsg('');
    setSuccessMsg('');
    setEditingId(null);
    setImageSourceMode('upload');
    setUploadError('');
  };

  const handleOpenCreateForm = () => {
    setFormMode('create');
    resetForm();
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (item: Equipment) => {
    setFormMode('edit');
    setEditingId(item.id);
    setCode(item.code);
    setName(item.name);
    setCategory(item.category);
    setStatus(item.status);
    setLocation(item.location);
    setDescription(item.description);
    setImageUrl(item.image_url);
    setTotalQty(item.total_qty ?? 1);
    setAvailableQty(item.available_qty ?? (item.status === 'borrowed' ? 0 : 1));
    setMaintenanceQty(item.maintenance_qty ?? (item.status === 'maintenance' ? 1 : 0));
    setBrokenQty(item.broken_qty ?? (item.status === 'broken' ? 1 : 0));
    setErrorMsg('');
    setSuccessMsg('');
    const hasBase64 = item.image_url && item.image_url.startsWith('data:image');
    setImageSourceMode(hasBase64 ? 'upload' : 'url');
    setUploadError('');
    setIsFormOpen(true);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    setUploadError('');
    if (!file.type.startsWith('image/')) {
      setUploadError('กรุณาเลือกไฟล์รูปภาพเท่านั้น (.png, .jpg, .jpeg, .webp)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('ขนาดไฟล์ภาพใหญ่เกินไป กรุณาเลือกภาพไม่เกิน 10MB');
      return;
    }

    try {
      const base64Data = await compressAndConvertToBase64(file);
      setImageUrl(base64Data);
    } catch (err) {
      console.error(err);
      setUploadError('ไม่สามารถประมวลผลไฟล์ภาพนี้ได้');
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!code || !name || !category || !location) {
      setErrorMsg('กรุณากรอกข้อมูลสำคัญที่มีสัญลักษณ์ (*) ให้ครบสัดส่วน');
      return;
    }

    if (Number(totalQty) <= 0) {
      setErrorMsg('จำนวนพัสดุรวมทั้งหมดจะต้องมากกว่า 0 ชิ้น');
      return;
    }

    // Check duplicate code in create mode
    if (formMode === 'create' && items.some(x => x.code.toLowerCase() === code.toLowerCase())) {
      setErrorMsg(`รหัสอุปกรณ์ "${code}" มีการลงทะเบียนในระบบเรียบร้อยแล้ว`);
      return;
    }

    // Logic to computed Available Quantities securely
    const oldBorrowedQty = formMode === 'edit' && editingId
      ? Math.max(0, (items.find(x => x.id === editingId)?.total_qty ?? 1) - (items.find(x => x.id === editingId)?.available_qty ?? 1) - (items.find(x => x.id === editingId)?.maintenance_qty ?? 0) - (items.find(x => x.id === editingId)?.broken_qty ?? 0))
      : 0;

    const computedAvailable = Number(totalQty) - oldBorrowedQty - Number(maintenanceQty) - Number(brokenQty);

    if (computedAvailable < 0) {
      setErrorMsg(`จำนวนรวมไม่สอดคล้อง! มีสินค้าถูกยืมพัวพันอยู่ ${oldBorrowedQty} ชิ้น ส่งผลให้พร้อมใช้งานติดลบ (${computedAvailable}) โปรดตั้งจำนวนรวมเพิ่มขึ้น หรือลดชำรุด/ส่งซ่อม`);
      return;
    }

    // Determine status automatically
    let nextStatus: 'available' | 'borrowed' | 'maintenance' | 'broken' = 'available';
    if (computedAvailable > 0) {
      nextStatus = 'available';
    } else if (oldBorrowedQty > 0) {
      nextStatus = 'borrowed';
    } else if (Number(maintenanceQty) > 0) {
      nextStatus = 'maintenance';
    } else {
      nextStatus = 'broken';
    }

    const itemPayload = {
      code,
      name,
      category,
      status: nextStatus,
      location,
      description,
      total_qty: Number(totalQty),
      available_qty: computedAvailable,
      maintenance_qty: Number(maintenanceQty),
      broken_qty: Number(brokenQty),
      image_url: imageUrl || 'https://images.unsplash.com/photo-1557862921-37829c790f19?w=500&auto=format&fit=crop&q=80'
    };

    try {
      if (formMode === 'create') {
        await addEquipment(config, itemPayload);
        setSuccessMsg('ลงทะเบียนเพิ่มอุปกรณ์ CCTV ในคลังพัสดุสำเร็จเสร็จสิ้น!');
        onRefresh();
        setTimeout(() => setIsFormOpen(false), 1500);
      } else if (formMode === 'edit' && editingId) {
        await updateEquipment(config, {
          ...itemPayload,
          id: editingId,
          created_at: items.find(x => x.id === editingId)?.created_at || new Date().toISOString()
        });
        setSuccessMsg('แก้ไขรายละเอียดพัสดุและอัปเดตจำนวนสต็อกเรียบร้อย!');
        onRefresh();
        setTimeout(() => setIsFormOpen(false), 1500);
      }
    } catch (err: any) {
      setErrorMsg(`ไม่สามารถดำเนินการได้สำเร็จ: ${err?.message || 'โปรดเชื่อมโยงอินเทอร์เน็ตหรือตรวจสอบสิทธิ์ RLS'}`);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    setDeleteConfirmId(id);
    setDeleteConfirmName(name);
    setDeleteError('');
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmId) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await deleteEquipment(config, deleteConfirmId);
      setDeleteConfirmId(null);
      setDeleteConfirmName('');
      onRefresh();
    } catch (err: any) {
      setDeleteError(err?.message || 'โปรดเชื่อมโยงอินเทอร์เน็ตหรือตรวจสอบสิทธิ์ RLS');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtering Logic
  const filteredItems = items.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.location.toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchesStatus = selectedStatus === 'all' || item.status === selectedStatus;
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  return (
    <div className="space-y-4 text-left" id="inventory-view-root">
      {/* Top Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4" id="inventory-controls">
        <div>
          <h2 className="text-lg font-bold font-sans text-slate-800">ผังรายการอุปกรณ์ในคลัง</h2>
          <p className="text-xs text-slate-400 font-sans">จัดการคลัง ค้นหา ตรวจสอบ ซ่อมบำรุง และลงทะเบียนชิ้นใหม่พัสดุ</p>
        </div>
        
        <button
          onClick={handleOpenCreateForm}
          className="flex items-center justify-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white font-sans font-bold text-xs py-1.5 px-3 rounded transition-all self-start md:self-auto cursor-pointer"
          id="btn-add-item"
        >
          <Plus className="h-4 w-4" />
          <span>ลงทะเบียนสิ่งของใหม่</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded border border-slate-250 shadow-3xs grid grid-cols-1 md:grid-cols-12 gap-3" id="search-filter-grid">
        {/* Search */}
        <div className="relative md:col-span-5" id="search-box">
          <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาตามรหัส, ชื่อสิ่งของ หรือตำแหน่ง..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded border border-slate-200 text-xs font-sans focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Category Pick */}
        <div className="relative md:col-span-3" id="cat-filter-box">
          <div className="absolute left-3 top-3.5 text-slate-400">
            <Filter className="h-4 w-4" />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded border border-slate-200 text-xs font-sans focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
          >
            <option value="all">หมวดหมู่ทั้งหมด</option>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Status Pick */}
        <div className="relative md:col-span-4" id="status-filter-box">
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full pl-3 pr-4 py-2 rounded border border-slate-200 text-xs font-sans focus:outline-hidden focus:ring-1 focus:ring-blue-500 bg-white"
          >
            <option value="all">สถานะพัสดุ: ทั้งหมด</option>
            <option value="available">พร้อมใช้งาน (Available)</option>
            <option value="borrowed">ถูกยืมอยู่ (Borrowed)</option>
            <option value="maintenance">กำลังซ่อมตรวจ (Maintenance)</option>
            <option value="broken">ชำรุดเสียหาย (Broken)</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16" id="inventory-loading">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-3"></div>
          <p className="text-slate-500 font-sans text-xs">กำลังสแกนวิเคราะห์รายการพัสดุ...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded p-8 text-center border border-slate-250 shadow-3xs" id="inventory-empty">
          <AlertCircle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <h4 className="text-xs font-bold font-sans text-slate-600 uppercase tracking-widest">ไม่พบรายการพัสดุที่ตรงกับเงื่อนไข</h4>
          <p className="text-[11px] text-slate-400 font-sans mt-0.5">กรุณาลองปรับเปลี่ยนขอบเขตคำค้นหา หรือกด "ลงทะเบียนสิ่งของใหม่"</p>
        </div>
      ) : (
        /* Equipment Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="inventory-grid">
          {filteredItems.map(item => (
            <div 
              key={item.id} 
              className="bg-white border border-slate-200 overflow-hidden shadow-3xs transition-all duration-300 flex flex-col group rounded hover:border-blue-500"
              id={`item-card-${item.id}`}
            >
              {/* Card Image Area */}
              <div className="relative h-36 bg-slate-100/50 shrink-0 overflow-hidden">
                <img 
                  src={item.image_url} 
                  alt={item.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-500"
                />
                
                {/* Badge Status */}
                <span className={`absolute top-2 right-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold font-sans border shadow-3xs z-10 ${
                  item.status === 'available'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    : item.status === 'borrowed'
                      ? 'bg-blue-50 text-blue-700 border-blue-100'
                      : item.status === 'maintenance'
                        ? 'bg-amber-50 text-amber-700 border-amber-100'
                        : 'bg-rose-55 text-rose-700 border-rose-100'
                }`}>
                  <span className={`w-1 h-1 rounded-full mr-1.5 ${
                    item.status === 'available' ? 'bg-emerald-500' :
                    item.status === 'borrowed' ? 'bg-blue-500' :
                    item.status === 'maintenance' ? 'bg-amber-500' : 'bg-rose-500'
                  }`}></span>
                  {
                    item.status === 'available' ? 'พร้อมใช้งาน' :
                    item.status === 'borrowed' ? 'ถูกเบิกไป' :
                    item.status === 'maintenance' ? 'อยู่ระหว่างซ่อม' : 'ขัดข้อง/ชำรุด'
                  }
                </span>

                {/* Code on bottom left */}
                <div className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur-xs text-white px-1.5 py-0.5 rounded-sm text-[9px] font-mono select-all">
                  {item.code}
                </div>
              </div>

              {/* Card Contents */}
              <div className="p-3.5 flex-1 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-blue-600 font-sans tracking-wide">
                    <Tag className="h-3 w-3" />
                    <span>{item.category}</span>
                  </div>
                  
                  <h3 className="text-xs font-bold font-sans text-slate-800 leading-snug line-clamp-2 min-h-[32px] text-left">
                    {item.name}
                  </h3>

                  <div className="flex items-start gap-1 pb-1">
                    <MapPin className="h-3 w-3 text-slate-400 shrink-0 mt-0.5" />
                    <span className="text-[11px] text-slate-500 line-clamp-1">{item.location}</span>
                  </div>

                  {item.description && (
                    <div className="bg-slate-50 p-2 rounded border border-slate-100 text-[10px] text-slate-500 min-h-[44px] line-clamp-2 leading-relaxed">
                      {item.description}
                    </div>
                  )}

                  {/* Stock Quantities Badges */}
                  <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-slate-50">
                    <div className="bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-lg p-1.5 text-[10px] flex items-center justify-between font-sans">
                      <span className="font-medium text-slate-500">พร้อมเบิก:</span>
                      <span className="font-black text-xs text-emerald-700">{item.available_qty ?? 0} <span className="text-[9px] font-normal text-slate-400">/{item.total_qty ?? 1}</span></span>
                    </div>
                    {((item.maintenance_qty ?? 0) > 0 || (item.broken_qty ?? 0) > 0) ? (
                      <div className="bg-rose-50 text-rose-800 border border-rose-100 rounded-lg p-1.5 text-[10px] flex items-center justify-between font-sans">
                        <span className="font-medium text-slate-500">ส่งซ่อม/ชำรุด:</span>
                        <span className="font-black text-xs text-rose-600">{(item.maintenance_qty ?? 0) + (item.broken_qty ?? 0)}</span>
                      </div>
                    ) : (
                      <div className="bg-slate-50 text-slate-400 border border-slate-100 rounded-lg p-1.5 text-[10px] flex items-center justify-between font-sans">
                        <span className="font-medium text-slate-500 text-[9px]">สภาพสมบูรณ์:</span>
                        <span className="font-bold text-xs text-slate-400">✓</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Operations Footer */}
                <div className="flex items-center justify-between border-t border-slate-100 pt-2.5 mt-2.5 shrink-0">
                  <div className="text-[9px] font-mono text-slate-400">
                    เพิ่ม: {item.created_at ? new Date(item.created_at).toLocaleDateString('th-TH') : ''}
                  </div>
                  
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => handleOpenEditForm(item)}
                      className="p-1 bg-slate-50 text-slate-600 hover:bg-slate-200 rounded transition-all"
                      title="แก้ไขข้อมูลพัสดุ"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    
                    <button
                      onClick={() => handleDeleteClick(item.id, item.name)}
                      disabled={item.status === 'borrowed'}
                      className={`p-1 rounded transition-all ${
                        item.status === 'borrowed'
                          ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                          : 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                      }`}
                      title={item.status === 'borrowed' ? 'ไม่สามารถลบเพราะมีรายการยืมค้างอยู่' : 'ลบจากคลังสารสนเทศ'}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Slide-over Panel for Create / Edit Form */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden" id="form-overlay-wrapper">
          <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-xs transition-opacity" onClick={() => setIsFormOpen(false)} />
          
          <div className="absolute inset-y-0 right-0 max-w-full pl-10 flex">
            <div className="w-screen max-w-lg bg-white shadow-2xl flex flex-col h-full rounded-l-3xl overflow-hidden text-left border-l border-slate-100">
              {/* Form Title */}
              <div className="px-6 py-5 bg-indigo-950 text-white flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-md font-bold font-sans">
                    {formMode === 'create' ? 'ลงทะเบียนพัสดุชิ้นใหม่' : 'ปรับแก้ข้อมูลพัสดุ'}
                  </h3>
                  <p className="text-3xs text-indigo-200 mt-1">
                    {formMode === 'create' ? 'กรอกข้อมูลเพื่อลงบัญชีเข้าระบบ' : 'แก้ไขประเด็นเพื่อให้ความถูกต้องล่าสุด'}
                  </p>
                </div>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="p-1 rounded-full text-indigo-200 hover:text-white hover:bg-indigo-900/55 transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4" id="inventory-edit-form">
                
                {/* Error/Success messages inside form */}
                {errorMsg && (
                  <div className="p-3 bg-rose-50 text-rose-700 border border-rose-100 rounded-xl text-xs font-sans flex items-start gap-1.5">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}
                {successMsg && (
                  <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-xl text-xs font-sans flex items-start gap-1.5">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{successMsg}</span>
                  </div>
                )}

                {/* Equipment code */}
                <div>
                  <label className="block text-2xs font-mono text-gray-400 uppercase tracking-wider mb-1.5 font-bold">รหัสอุปกรณ์ (Equipment Code) *</label>
                  <input
                    type="text"
                    required
                    disabled={formMode === 'edit'}
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className={`w-full px-3 py-2 border rounded-xl text-sm font-sans focus:outline-hidden focus:ring-1 focus:ring-indigo-500 ${
                      formMode === 'edit' ? 'bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed' : 'border-gray-300'
                    }`}
                    placeholder="รหัสเฉพาะตน เช่น EQ-2026-050"
                  />
                  {formMode === 'create' && (
                    <p className="text-[10px] text-gray-450 mt-1">
                      สามารถกำหนดเอง หรือใช้รหัสที่ระบบรันให้ข้างต้นได้
                    </p>
                  )}
                </div>

                {/* Equipment category */}
                <div>
                  <label className="block text-2xs font-mono text-gray-400 uppercase tracking-wider mb-1.5 font-bold">หมวดหมู่พัสดุ (Category) *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-sans focus:outline-hidden focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Equipment name */}
                <div>
                  <label className="block text-2xs font-mono text-gray-400 uppercase tracking-wider mb-1.5 font-bold">ชื่อพัสดุอุปกรณ์ (Equipment Name) *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-sans focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                    placeholder="ระบุชื่อเรียกอุปกรณ์ เช่น กล้อง Dome HIKVISION 4MP"
                  />
                </div>

                {/* Quantities Inputs Row */}
                <div className="grid grid-cols-3 gap-3 bg-indigo-50/40 p-3 rounded-2xl border border-indigo-100">
                  <div>
                    <label className="block text-[10px] font-sans font-bold text-slate-600 mb-1">จำนวนรวมทั้งหมด *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={totalQty}
                      onChange={(e) => setTotalQty(Math.max(1, Number(e.target.value)))}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-sans focus:outline-hidden focus:ring-1 focus:ring-indigo-500 bg-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-sans font-bold text-amber-700 mb-1">ส่งตรวจซ่อม</label>
                    <input
                      type="number"
                      min={0}
                      value={maintenanceQty}
                      onChange={(e) => setMaintenanceQty(Math.max(0, Number(e.target.value)))}
                      className="w-full px-2.5 py-1.5 border border-amber-200 rounded-lg text-xs font-sans focus:outline-hidden focus:ring-1 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-sans font-bold text-rose-700 mb-1">ชำรุดเสียหาย</label>
                    <input
                      type="number"
                      min={0}
                      value={brokenQty}
                      onChange={(e) => setBrokenQty(Math.max(0, Number(e.target.value)))}
                      className="w-full px-2.5 py-1.5 border border-rose-200 rounded-lg text-xs font-sans focus:outline-hidden focus:ring-1 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                </div>

                {/* Storage location */}
                <div>
                  <label className="block text-2xs font-mono text-gray-400 uppercase tracking-wider mb-1.5 font-bold">สถานที่และตำแหน่งเก็บรักษา *</label>
                  
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <select
                        required
                        id="location-select"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-xs font-sans focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                      >
                        <option value="">-- กรุณาเลือกสถานที่เก็บ --</option>
                        {locationsList.map((loc) => (
                          <option key={loc} value={loc}>{loc}</option>
                        ))}
                      </select>
                    </div>
                    
                    <button
                      type="button"
                      id="btn-toggle-add-location"
                      onClick={() => setShowAddLocation(!showAddLocation)}
                      className={`px-3.5 py-2 text-xs font-bold font-sans rounded-xl border transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                        showAddLocation
                          ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                          : 'bg-indigo-50 border-indigo-150 text-indigo-700 hover:bg-indigo-100'
                      }`}
                    >
                      {showAddLocation ? (
                        <>ปิดช่องเพิ่ม</>
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5" />
                          <span>เพิ่มสถานที่</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Inline Add Location Panel */}
                  {showAddLocation && (
                    <div className="mt-2.5 p-3.5 bg-slate-50 border border-slate-150 rounded-xl space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-200" id="add-location-panel">
                      <label className="block text-[10px] font-sans font-bold text-slate-600">กรอกชื่อสถานที่เก็บชื่อใหม่ที่นี่</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          id="new-location-input"
                          value={newLocationInput}
                          onChange={(e) => setNewLocationInput(e.target.value)}
                          placeholder="เช่น ตึก B ชั้น 3 ข้างห้องไอที"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-xs font-sans focus:outline-hidden focus:ring-1 focus:ring-indigo-500 bg-white"
                        />
                        <button
                          type="button"
                          id="submit-new-location"
                          disabled={!newLocationInput.trim()}
                          onClick={() => {
                            if (newLocationInput.trim()) {
                              const clean = newLocationInput.trim();
                              if (!locationsList.includes(clean)) {
                                const updated = [...locationsList, clean];
                                saveLocationsList(updated);
                                setLocation(clean);
                              } else {
                                setLocation(clean);
                              }
                              setNewLocationInput('');
                              setShowAddLocation(false);
                            }
                          }}
                          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold font-sans text-xs rounded-lg shadow-2xs cursor-pointer select-none disabled:opacity-50"
                        >
                          บันทึก
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-2xs font-mono text-gray-400 uppercase tracking-wider mb-1.5">หมายรายละเอียด / รายละเอียดเบื้องลึก</label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-sans focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="เช่น คุณสมบัติทางเทคนิค หมายเลขประจำเครื่อง (S/N) หรือข้อมูลสำคัญในการดูแล"
                  />
                </div>

                {/* Image Source Toggle and Upload Options */}
                <div className="space-y-2">
                  <label className="block text-2xs font-mono text-gray-400 uppercase tracking-wider mb-0.5">ภาพประกอบรูปพัสดุ (Equipment Image)</label>
                  
                  <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => {
                        setImageSourceMode('upload');
                        setUploadError('');
                      }}
                      className={`py-1.5 text-xs font-sans font-bold rounded-lg transition-all cursor-pointer ${
                        imageSourceMode === 'upload'
                          ? 'bg-white text-slate-800 shadow-3xs'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      📁 อัปโหลดไฟล์รูปภาพ
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setImageSourceMode('url');
                        setUploadError('');
                      }}
                      className={`py-1.5 text-xs font-sans font-bold rounded-lg transition-all cursor-pointer ${
                        imageSourceMode === 'url'
                          ? 'bg-white text-slate-800 shadow-3xs'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      🌐 ใส่ลิงก์ URL รูปภาพ
                    </button>
                  </div>

                  {imageSourceMode === 'upload' ? (
                    <div className="space-y-2">
                      {/* Drag & Drop Area */}
                      <div
                        onDragEnter={handleDrag}
                        onDragOver={handleDrag}
                        onDragLeave={handleDrag}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-2xl p-5 text-center flex flex-col items-center justify-center transition-all ${
                          dragActive 
                            ? 'border-indigo-500 bg-indigo-50/50' 
                            : imageUrl && imageUrl.startsWith('data:image')
                              ? 'border-emerald-300 bg-emerald-50/5'
                              : 'border-slate-300 hover:border-slate-400 bg-slate-50'
                        }`}
                      >
                        {imageUrl && imageUrl.startsWith('data:image') ? (
                          <div className="space-y-3 w-full flex flex-col items-center">
                            <div className="relative w-28 h-28 rounded-xl overflow-hidden border border-emerald-250 bg-slate-50 shadow-xs flex items-center justify-center">
                              <img 
                                src={imageUrl} 
                                alt="Uploaded preview" 
                                className="w-full h-full object-contain p-1"
                              />
                              <button
                                type="button"
                                onClick={() => setImageUrl('')}
                                className="absolute top-1 right-1 bg-rose-600 hover:bg-rose-700 text-white p-1 rounded-full shadow-md transition cursor-pointer"
                                title="ลบรูปภาพ"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <span className="text-[10px] font-sans font-semibold text-emerald-800 bg-emerald-100/50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                              ✓ พร้อมบันทึกภาพอัปโหลดแล้ว
                            </span>
                            <label className="text-[10px] font-sans text-indigo-600 hover:text-indigo-805 cursor-pointer font-bold underline">
                              เปลี่ยนรูปภาพใหม่...
                              <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={handleFileChange} 
                              />
                            </label>
                          </div>
                        ) : (
                          <>
                            <FileImage className={`h-8 w-8 mb-2 ${dragActive ? 'text-indigo-500 animate-bounce' : 'text-slate-400'}`} />
                            <p className="text-xs font-sans text-slate-600 select-none">
                              ลากรูปภาพมาวางที่นี่ หรือ{' '}
                              <label className="text-indigo-600 hover:text-indigo-700 cursor-pointer font-bold underline">
                                เลือกไฟล์จากเครื่อง
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  className="hidden" 
                                  onChange={handleFileChange} 
                                />
                              </label>
                            </p>
                            <p className="text-[10px] font-sans text-slate-400 mt-1 select-none">
                              ไฟล์รูปภาพทุกประเภท ไม่เกิน 10MB (ระบบแปลงย่อขนาดแบบปลอดภัยอัตโนมัติ)
                            </p>
                          </>
                        )}
                      </div>

                      {uploadError && (
                        <p className="text-[11px] text-rose-600 font-sans mt-1 bg-rose-50 p-2 rounded-lg border border-rose-100 flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5" /> {uploadError}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="url"
                        value={imageUrl && !imageUrl.startsWith('data:image') ? imageUrl : ''}
                        onChange={(e) => setImageUrl(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-sans focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                        placeholder="กรอก URL รูปภาพจากอินเทอร์เน็ต เช่น https://images.unsplash.com/..."
                      />
                      
                      {imageUrl && !imageUrl.startsWith('data:image') && (
                        <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200">
                          <img 
                            src={imageUrl} 
                            alt="URL Preview" 
                            className="w-12 h-12 object-cover rounded-lg border border-slate-250 shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1557862921-37829c790f19?w=500&auto=format&fit=crop&q=80';
                            }}
                          />
                          <div className="text-left">
                            <div className="text-[10px] text-slate-450 font-sans font-bold">ตัวอย่างภาพประกอบ:</div>
                            <div className="text-[10px] text-slate-600 font-mono truncate max-w-[280px]">{imageUrl}</div>
                          </div>
                        </div>
                      )}

                      {/* Stock shortcuts */}
                      <div className="pt-1">
                        <span className="text-[10px] text-slate-400 font-sans block mb-1">หรือเลือกรูปภาพยอดนิยม:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {STOCK_IMAGES.map((img) => (
                            <button
                              key={img.name}
                              type="button"
                              onClick={() => setImageUrl(img.url)}
                              className="text-[9px] font-sans px-2 py-1 bg-slate-50 border border-slate-200 text-slate-600 rounded-md hover:bg-slate-100 font-medium transition-all cursor-pointer"
                            >
                              {img.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </form>

              {/* Form buttons */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-xl text-sm font-sans font-medium hover:bg-white text-gray-700 transition"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleSubmit}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-sans font-semibold text-sm rounded-xl shadow-xs transition cursor-pointer"
                >
                  {formMode === 'create' ? 'เบิกบันทึกสิ่งของใหม่' : 'จัดเก็บการเปลี่ยนแปลง'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-150 shadow-2xl max-w-sm w-full p-6 text-left relative overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="p-2.5 bg-red-50 rounded-full">
                <Trash2 className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-extrabold font-sans text-slate-900">คุณแน่ใจหรือไม่ว่าต้องการลบ?</h3>
            </div>
            
            <p className="text-xs text-slate-500 font-sans leading-relaxed mb-6">
              ต้องการลบอุปกรณ์ <strong className="text-slate-850 font-bold font-sans">"{deleteConfirmName}"</strong> ออกจากคลังพัสดุถาวรใช่หรือไม่? ระบบจะลบประวัติการทำรายการเบิก-คืนที่เชื่อมโยงอยู่กับชิ้นพัสดุนี้ด้วยเพื่อเสถียรภาพฐานข้อมูล
            </p>

            {deleteError && (
              <div className="mb-4 p-2.5 bg-red-50 border border-red-150 text-red-800 text-3xs font-medium rounded-xl leading-relaxed">
                🚨 {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end space-x-2.5">
              <button
                type="button"
                onClick={() => { setDeleteConfirmId(null); setDeleteConfirmName(''); }}
                disabled={isDeleting}
                className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold font-sans text-xs rounded-xl transition cursor-pointer select-none disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold font-sans text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer select-none disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>กำลังลบ...</span>
                  </>
                ) : (
                  <span>ใช่, แน่ใจลบเลย</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
