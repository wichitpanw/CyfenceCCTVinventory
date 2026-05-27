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
  FileImage,
  SlidersHorizontal,
  LayoutGrid,
  List
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
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  
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
    <div className="space-y-6 text-left animate-fade-in" id="inventory-view-root">
      {/* Top Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4" id="inventory-controls">
        <div>
          <h2 className="text-xl font-bold font-sans text-[#1D1D1F] tracking-tight">ผังรายการอุปกรณ์ในคลัง</h2>
          <p className="text-xs text-[#86868B] font-sans mt-0.5">จัดการคลัง ค้นหา ตรวจสอบ ซ่อมบำรุง และลงทะเบียนชิ้นใหม่พัสดุ</p>
        </div>
        
        <button
          onClick={handleOpenCreateForm}
          className="flex items-center justify-center space-x-1.5 bg-[#000000] hover:bg-[#1D1D1F] active:scale-95 text-white font-sans font-semibold text-xs py-2.5 px-4 rounded-full transition-all duration-200 self-start md:self-auto cursor-pointer shadow-sm hover:shadow-md"
          id="btn-add-item"
        >
          <Plus className="h-4 w-4" />
          <span>ลงทะเบียนสิ่งของใหม่</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-2xl border border-[#E8E8ED] shadow-[0_8px_30px_rgba(0,0,0,0.04)] flex items-center gap-2" id="search-filter-grid">
        {/* Search */}
        <div className="relative flex-1" id="search-box">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-[#86868B] pointer-events-none" />
          <input
            type="text"
            placeholder="ค้นหาตามรหัส, ชื่อสิ่งของ หรือตำแหน่ง..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#F5F5F7] border border-transparent text-xs font-sans text-[#1D1D1F] placeholder-[#86868B] focus:outline-hidden focus:bg-white focus:border-[#000000] focus:ring-4 focus:ring-[#000000]/10 transition-all duration-200"
          />
        </div>

        {/* Category Pick */}
        <div className="relative shrink-0" id="cat-filter-box">
          <div 
            className={`flex items-center justify-center w-10 h-10 rounded-full border transition-all duration-200 cursor-pointer ${
              selectedCategory !== 'all'
                ? 'bg-[#F5F5F7] border-[#000000] text-[#000000]'
                : 'bg-[#F5F5F7] border-[#E8E8ED] text-[#86868B] hover:bg-[#E8E8ED] hover:text-[#1D1D1F]'
            }`}
            title={`หมวดหมู่พัสดุ: ${selectedCategory === 'all' ? 'ทั้งหมด' : selectedCategory}`}
          >
            <Filter className="h-4 w-4" />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          >
            <option value="all">หมวดหมู่ทั้งหมด</option>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Status Pick */}
        <div className="relative shrink-0" id="status-filter-box">
          <div 
            className={`flex items-center justify-center w-10 h-10 rounded-full border transition-all duration-200 cursor-pointer ${
              selectedStatus !== 'all'
                ? 'bg-[#F5F5F7] border-[#000000] text-[#000000]'
                : 'bg-[#F5F5F7] border-[#E8E8ED] text-[#86868B] hover:bg-[#E8E8ED] hover:text-[#1D1D1F]'
            }`}
            title={`สถานะพัสดุ: ${
              selectedStatus === 'all' ? 'ทั้งหมด' :
              selectedStatus === 'available' ? 'พร้อมใช้งาน' :
              selectedStatus === 'borrowed' ? 'ถูกยืมอยู่' :
              selectedStatus === 'maintenance' ? 'กำลังซ่อมตรวจ' : 'ชำรุดเสียหาย'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
          </div>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          >
            <option value="all">สถานะพัสดุ: ทั้งหมด</option>
            <option value="available">พร้อมใช้งาน (Available)</option>
            <option value="borrowed">ถูกยืมอยู่ (Borrowed)</option>
            <option value="maintenance">กำลังซ่อมตรวจ (Maintenance)</option>
            <option value="broken">ชำรุดเสียหาย (Broken)</option>
          </select>
        </div>

        {/* View Toggle */}
        <div className="flex items-center bg-[#F5F5F7] p-1 rounded-xl border border-[#E8E8ED] shrink-0" id="view-toggle">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-white text-black shadow-xs'
                : 'text-[#86868B] hover:text-[#1D1D1F]'
            }`}
            title="แสดงผลแบบการ์ดตาราง"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              viewMode === 'table'
                ? 'bg-white text-black shadow-xs'
                : 'text-[#86868B] hover:text-[#1D1D1F]'
            }`}
            title="แสดงผลแบบตารางรายการ"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20" id="inventory-loading">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#E8E8ED] border-t-[#000000] mb-3"></div>
          <p className="text-[#86868B] font-sans text-xs">กำลังสแกนวิเคราะห์รายการพัสดุ...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-[#E8E8ED] shadow-[0_8px_30px_rgba(0,0,0,0.04)]" id="inventory-empty">
          <AlertCircle className="h-10 w-10 text-[#86868B] mx-auto mb-3 opacity-60" />
          <h4 className="text-sm font-bold font-sans text-[#1D1D1F] tracking-tight">ไม่พบรายการพัสดุที่ตรงกับเงื่อนไข</h4>
          <p className="text-xs text-[#86868B] font-sans mt-1">กรุณาลองปรับเปลี่ยนขอบเขตคำค้นหา หรือกด "ลงทะเบียนสิ่งของใหม่"</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* Equipment Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" id="inventory-grid">
          {filteredItems.map(item => (
            <div 
              key={item.id} 
              className="bg-white border border-[#E8E8ED] overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:border-[#000000]/30 transition-all duration-300 flex flex-col group rounded-2xl"
              id={`item-card-${item.id}`}
            >
              {/* Card Image Area */}
              <div className="relative h-40 bg-[#F5F5F7] shrink-0 overflow-hidden flex items-center justify-center border-b border-[#E8E8ED]/30">
                <img 
                  src={item.image_url} 
                  alt={item.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-500 ease-out"
                />
                
                {/* Badge Status */}
                <span className={`absolute top-3 right-3 inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-bold font-sans shadow-3xs z-10 ${
                  item.status === 'available'
                    ? 'bg-[#E5F9E0] text-[#1E7F28]'
                    : item.status === 'borrowed'
                      ? 'bg-[#F5F5F7] text-[#000000]'
                      : item.status === 'maintenance'
                        ? 'bg-[#FEF3D6] text-[#B76E00]'
                        : 'bg-[#FEEBEB] text-[#D12B2B]'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                    item.status === 'available' ? 'bg-[#1E7F28]' :
                    item.status === 'borrowed' ? 'bg-[#000000]' :
                    item.status === 'maintenance' ? 'bg-[#B76E00]' : 'bg-[#D12B2B]'
                  }`}></span>
                  {
                    item.status === 'available' ? 'พร้อมใช้งาน' :
                    item.status === 'borrowed' ? 'ถูกเบิกไป' :
                    item.status === 'maintenance' ? 'อยู่ระหว่างซ่อม' : 'ขัดข้อง/ชำรุด'
                  }
                </span>
 
                {/* Code on bottom left */}
                <div className="absolute bottom-3 left-3 bg-[#1D1D1F]/80 backdrop-blur-xs text-white px-2 py-0.5 rounded-md text-[9px] font-mono select-all">
                  {item.code}
                </div>
              </div>
 
              {/* Card Contents */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-[#000000] font-sans tracking-wider uppercase">
                    <Tag className="h-3 w-3" />
                    <span>{item.category}</span>
                  </div>
                  
                  <h3 className="text-xs font-bold font-sans text-[#1D1D1F] leading-snug line-clamp-2 min-h-[32px] text-left">
                    {item.name}
                  </h3>
 
                  <div className="flex items-start gap-1 pb-1">
                    <MapPin className="h-3.5 w-3.5 text-[#86868B] shrink-0 mt-0.5" />
                    <span className="text-[11px] text-[#86868B] line-clamp-1">{item.location}</span>
                  </div>
 
                  {item.description && (
                    <div className="bg-[#F5F5F7] p-2.5 rounded-xl text-[10px] text-[#86868B] min-h-[44px] line-clamp-2 leading-relaxed">
                      {item.description}
                    </div>
                  )}
 
                  {/* Stock Quantities Badges */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E8E8ED]/40">
                    <div className="bg-[#E5F9E0]/50 text-[#1E7F28] rounded-xl p-2 text-[10px] flex items-center justify-between font-sans">
                      <span className="font-medium text-[#86868B]">พร้อมเบิก:</span>
                      <span className="font-extrabold text-xs text-[#1E7F28]">{item.available_qty ?? 0} <span className="text-[9px] font-normal text-[#86868B]">/{item.total_qty ?? 1}</span></span>
                    </div>
                    {((item.maintenance_qty ?? 0) > 0 || (item.broken_qty ?? 0) > 0) ? (
                      <div className="bg-[#FEEBEB]/50 text-[#D12B2B] rounded-xl p-2 text-[10px] flex items-center justify-between font-sans">
                        <span className="font-medium text-[#86868B]">ส่งซ่อม/ชำรุด:</span>
                        <span className="font-extrabold text-xs text-[#D12B2B]">{(item.maintenance_qty ?? 0) + (item.broken_qty ?? 0)}</span>
                      </div>
                    ) : (
                      <div className="bg-[#E5F9E0]/20 text-[#1E7F28] rounded-xl p-2 text-[10px] flex items-center justify-between font-sans border border-[#E5F9E0]/40">
                        <span className="font-medium text-[#86868B] text-[9px]">สภาพสมบูรณ์:</span>
                        <span className="font-bold text-xs text-[#1E7F28]">✓</span>
                      </div>
                    )}
                  </div>
                </div>
 
                {/* Operations Footer */}
                <div className="flex items-center justify-between border-t border-[#E8E8ED]/40 pt-3 mt-3 shrink-0">
                  <div className="text-[9px] font-mono text-[#86868B]">
                    เพิ่ม: {item.created_at ? new Date(item.created_at).toLocaleDateString('th-TH') : ''}
                  </div>
                  
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => handleOpenEditForm(item)}
                      className="p-1.5 bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#E8E8ED] rounded-full transition-all duration-200"
                      title="แก้ไขข้อมูลพัสดุ"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    
                    <button
                      onClick={() => handleDeleteClick(item.id, item.name)}
                      disabled={item.status === 'borrowed'}
                      className={`p-1.5 rounded-full transition-all duration-200 ${
                        item.status === 'borrowed'
                          ? 'bg-[#F5F5F7] text-[#C5C5C7] cursor-not-allowed'
                          : 'bg-[#FEEBEB] text-[#D12B2B] hover:bg-[#FCD7D7]'
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
      ) : (
        /* Equipment Table View */
        <div className="overflow-x-auto bg-white border border-[#E8E8ED] rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.02)]" id="inventory-table-container">
          <table className="min-w-full divide-y divide-[#E8E8ED] table-auto">
            <thead className="bg-[#F5F5F7]">
              <tr>
                <th scope="col" className="px-4 py-3 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider text-left font-sans whitespace-nowrap w-16">ภาพ</th>
                <th scope="col" className="px-4 py-3 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider text-left font-sans whitespace-nowrap w-24">รหัส</th>
                <th scope="col" className="px-4 py-3 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider text-left font-sans whitespace-nowrap">ชื่อพัสดุอุปกรณ์</th>
                <th scope="col" className="px-4 py-3 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider text-left font-sans whitespace-nowrap">หมวดหมู่</th>
                <th scope="col" className="px-4 py-3 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider text-left font-sans whitespace-nowrap">ตำแหน่งที่เก็บ</th>
                <th scope="col" className="px-4 py-3 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider text-center font-sans whitespace-nowrap w-28">พร้อมใช้ / ทั้งหมด</th>
                <th scope="col" className="px-4 py-3 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider text-center font-sans whitespace-nowrap w-24">สถานะ</th>
                <th scope="col" className="px-4 py-3 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider text-center font-sans whitespace-nowrap w-24">จัดการ</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-[#E8E8ED]">
              {filteredItems.map(item => (
                <tr key={item.id} className="hover:bg-[#F5F5F7]/40 transition-colors">
                  {/* Thumbnail */}
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <div className="w-10 h-10 rounded-lg bg-[#F5F5F7] border border-[#E8E8ED] flex items-center justify-center p-1 overflow-hidden shrink-0">
                      <img src={item.image_url} alt={item.name} className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    </div>
                  </td>
                  {/* Code */}
                  <td className="px-4 py-2.5 whitespace-nowrap text-xs font-mono font-bold text-slate-650">
                    <span className="bg-[#F5F5F7] px-2 py-0.5 rounded-md border border-[#E8E8ED] select-all">
                      {item.code}
                    </span>
                  </td>
                  {/* Name */}
                  <td className="px-4 py-2.5 text-xs font-bold text-[#1D1D1F] max-w-xs truncate" title={item.name}>
                    {item.name}
                  </td>
                  {/* Category */}
                  <td className="px-4 py-2.5 whitespace-nowrap text-[10px] text-slate-550 font-bold">
                    {item.category}
                  </td>
                  {/* Location */}
                  <td className="px-4 py-2.5 text-xs text-slate-500 truncate max-w-44" title={item.location}>
                    {item.location}
                  </td>
                  {/* Stock */}
                  <td className="px-4 py-2.5 whitespace-nowrap text-center text-xs font-semibold font-sans">
                    <span className="bg-[#E5F9E0]/50 text-[#1E7F28] px-2 py-0.5 rounded-full font-bold">
                      {item.available_qty ?? 0}
                    </span>
                    <span className="text-slate-400 font-normal"> / {item.total_qty ?? 1}</span>
                  </td>
                  {/* Status */}
                  <td className="px-4 py-2.5 whitespace-nowrap text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold font-sans ${
                      item.status === 'available'
                        ? 'bg-[#E5F9E0] text-[#1E7F28]'
                        : item.status === 'borrowed'
                          ? 'bg-[#F5F5F7] text-[#000000]'
                          : item.status === 'maintenance'
                            ? 'bg-[#FEF3D6] text-[#B76E00]'
                            : 'bg-[#FEEBEB] text-[#D12B2B]'
                    }`}>
                      {
                        item.status === 'available' ? 'พร้อมใช้งาน' :
                        item.status === 'borrowed' ? 'ถูกเบิกไป' :
                        item.status === 'maintenance' ? 'อยู่ระหว่างซ่อม' : 'ขัดข้อง/ชำรุด'
                      }
                    </span>
                  </td>
                  {/* Actions */}
                  <td className="px-4 py-2.5 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center space-x-1">
                      <button
                        onClick={() => handleOpenEditForm(item)}
                        className="p-1 bg-[#F5F5F7] text-[#1D1D1F] hover:bg-[#E8E8ED] rounded-full transition cursor-pointer"
                        title="แก้ไขข้อมูลพัสดุ"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(item.id, item.name)}
                        disabled={item.status === 'borrowed'}
                        className={`p-1 rounded-full transition ${
                          item.status === 'borrowed'
                            ? 'bg-[#F5F5F7] text-[#C5C5C7] cursor-not-allowed'
                            : 'bg-[#FEEBEB] text-[#D12B2B] hover:bg-[#FCD7D7] cursor-pointer'
                        }`}
                        title={item.status === 'borrowed' ? 'ไม่สามารถลบเพราะมีรายการยืมค้างอยู่' : 'ลบจากคลัง'}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Slide-over Panel for Create / Edit Form */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden" id="form-overlay-wrapper">
          <div className="absolute inset-0 bg-[#1D1D1F]/30 backdrop-blur-sm transition-opacity" onClick={() => setIsFormOpen(false)} />
          
          <div className="absolute inset-y-0 right-0 max-w-full pl-10 flex">
            <div className="w-screen max-w-lg bg-[#F5F5F7] shadow-[0_20px_50px_rgba(0,0,0,0.15)] flex flex-col h-full rounded-l-3xl overflow-hidden text-left border-l border-[#E8E8ED]">
              {/* Form Title */}
              <div className="px-6 py-5 bg-white border-b border-[#E8E8ED] flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-sm font-bold font-sans text-[#1D1D1F]">
                    {formMode === 'create' ? 'ลงทะเบียนพัสดุชิ้นใหม่' : 'ปรับแก้ข้อมูลพัสดุ'}
                  </h3>
                  <p className="text-[10px] text-[#86868B] font-sans mt-0.5">
                    {formMode === 'create' ? 'กรอกรายละเอียดเพื่อลงบัญชีคลังพัสดุอุปกรณ์' : 'ปรับแก้ข้อมูลพัสดุและจำนวนคงคลัง'}
                  </p>
                </div>
                <button
                  onClick={() => setIsFormOpen(false)}
                  className="p-1.5 rounded-full text-[#86868B] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form Content */}
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar" id="inventory-edit-form">
                
                {/* Error/Success messages inside form */}
                {errorMsg && (
                  <div className="p-3 bg-[#FEEBEB] text-[#D12B2B] border border-[#FEEBEB]/40 rounded-xl text-xs font-sans flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-[#D12B2B]" />
                    <span>{errorMsg}</span>
                  </div>
                )}
                {successMsg && (
                  <div className="p-3 bg-[#E5F9E0] text-[#1E7F28] border border-[#E5F9E0]/40 rounded-xl text-xs font-sans flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-[#1E7F28]" />
                    <span>{successMsg}</span>
                  </div>
                )}

                {/* Equipment code */}
                <div className="bg-white p-4 rounded-2xl border border-[#E8E8ED] space-y-1.5 shadow-2xs">
                  <label className="block text-[10px] font-sans text-[#86868B] uppercase tracking-wider font-bold">รหัสอุปกรณ์ (Equipment Code) *</label>
                  <input
                    type="text"
                    required
                    disabled={formMode === 'edit'}
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-sans transition-all duration-200 focus:outline-hidden ${
                      formMode === 'edit' 
                        ? 'bg-[#F5F5F7] text-[#86868B] border-transparent cursor-not-allowed font-mono' 
                        : 'bg-[#F5F5F7] border-transparent focus:bg-white focus:border-[#000000] focus:ring-4 focus:ring-[#000000]/10 text-[#1D1D1F]'
                    }`}
                    placeholder="รหัสเฉพาะตน เช่น EQ-2026-050"
                  />
                  {formMode === 'create' && (
                    <p className="text-[9px] text-[#86868B] font-sans">
                      สามารถกำหนดเอง หรือใช้รหัสอัตโนมัติที่ระบบรันให้ข้างต้นได้
                    </p>
                  )}
                </div>

                {/* Equipment category */}
                <div className="bg-white p-4 rounded-2xl border border-[#E8E8ED] space-y-1.5 shadow-2xs">
                  <label className="block text-[10px] font-sans text-[#86868B] uppercase tracking-wider font-bold">หมวดหมู่พัสดุ (Category) *</label>
                  <div className="relative">
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#F5F5F7] border border-transparent rounded-xl text-xs font-sans text-[#1D1D1F] focus:outline-hidden focus:bg-white focus:border-[#000000] focus:ring-4 focus:ring-[#000000]/10 transition-all duration-200 appearance-none cursor-pointer"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-3.5 top-3.5 pointer-events-none text-[#86868B] text-[9px]">▼</div>
                  </div>
                </div>

                {/* Equipment name */}
                <div className="bg-white p-4 rounded-2xl border border-[#E8E8ED] space-y-1.5 shadow-2xs">
                  <label className="block text-[10px] font-sans text-[#86868B] uppercase tracking-wider font-bold">ชื่อพัสดุอุปกรณ์ (Equipment Name) *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F5F5F7] border border-transparent rounded-xl text-xs font-sans text-[#1D1D1F] placeholder-[#86868B] focus:outline-hidden focus:bg-white focus:border-[#000000] focus:ring-4 focus:ring-[#000000]/10 transition-all duration-200"
                    placeholder="ระบุชื่อเรียกอุปกรณ์ เช่น กล้อง Dome HIKVISION 4MP"
                  />
                </div>

                {/* Quantities Inputs Row */}
                <div className="bg-white p-4 rounded-2xl border border-[#E8E8ED] space-y-3 shadow-2xs">
                  <label className="block text-[10px] font-sans text-[#86868B] uppercase tracking-wider font-bold">การควบคุมจำนวนสต็อกในคลัง (Stock Limits) *</label>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="block text-[9px] font-sans font-bold text-[#1D1D1F]">จำนวนรวมทั้งหมด *</label>
                      <input
                        type="number"
                        required
                        min={1}
                        value={totalQty}
                        onChange={(e) => setTotalQty(Math.max(1, Number(e.target.value)))}
                        className="w-full px-3 py-2 bg-[#F5F5F7] border border-transparent rounded-xl text-xs font-sans text-[#1D1D1F] focus:outline-hidden focus:bg-white focus:border-[#000000] transition-all duration-200 font-bold text-center"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-sans font-bold text-[#B76E00]">ส่งตรวจซ่อม</label>
                      <input
                        type="number"
                        min={0}
                        value={maintenanceQty}
                        onChange={(e) => setMaintenanceQty(Math.max(0, Number(e.target.value)))}
                        className="w-full px-3 py-2 bg-[#F5F5F7] border border-transparent rounded-xl text-xs font-sans text-[#1D1D1F] focus:outline-hidden focus:bg-white focus:border-[#000000] transition-all duration-200 text-center"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-sans font-bold text-[#D12B2B]">ชำรุดเสียหาย</label>
                      <input
                        type="number"
                        min={0}
                        value={brokenQty}
                        onChange={(e) => setBrokenQty(Math.max(0, Number(e.target.value)))}
                        className="w-full px-3 py-2 bg-[#F5F5F7] border border-transparent rounded-xl text-xs font-sans text-[#1D1D1F] focus:outline-hidden focus:bg-white focus:border-[#000000] transition-all duration-200 text-center"
                      />
                    </div>
                  </div>
                </div>

                {/* Storage location */}
                <div className="bg-white p-4 rounded-2xl border border-[#E8E8ED] space-y-2.5 shadow-2xs">
                  <label className="block text-[10px] font-sans text-[#86868B] uppercase tracking-wider font-bold">สถานที่และตำแหน่งเก็บรักษา (Location) *</label>
                  
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <select
                        required
                        id="location-select"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full pl-3.5 pr-8 py-2.5 bg-[#F5F5F7] border border-transparent rounded-xl text-xs font-sans text-[#1D1D1F] focus:outline-hidden focus:bg-white focus:border-[#000000] focus:ring-4 focus:ring-[#000000]/10 transition-all duration-200 appearance-none cursor-pointer"
                      >
                        <option value="">-- กรุณาเลือกสถานที่เก็บ --</option>
                        {locationsList.map((loc) => (
                          <option key={loc} value={loc}>{loc}</option>
                        ))}
                      </select>
                      <div className="absolute right-3.5 top-3.5 pointer-events-none text-[#86868B] text-[9px]">▼</div>
                    </div>
                    
                    <button
                      type="button"
                      id="btn-toggle-add-location"
                      onClick={() => setShowAddLocation(!showAddLocation)}
                      className={`px-3 py-2.5 text-xs font-bold font-sans rounded-xl border transition-all duration-200 cursor-pointer flex items-center gap-1 shrink-0 ${
                        showAddLocation
                          ? 'bg-[#FEEBEB] border-transparent text-[#D12B2B] hover:bg-[#FCD7D7]'
                          : 'bg-[#F5F5F7] border-transparent text-[#000000] hover:bg-[#D4E8FF]'
                      }`}
                    >
                      {showAddLocation ? 'ปิดช่อง' : 'เพิ่มสถานที่'}
                    </button>
                  </div>

                  {/* Inline Add Location Panel */}
                  {showAddLocation && (
                    <div className="mt-2.5 p-3.5 bg-[#F5F5F7] border border-[#E8E8ED] rounded-xl space-y-2 animate-in fade-in slide-in-from-top-1 duration-200" id="add-location-panel">
                      <label className="block text-[9px] font-sans font-bold text-[#86868B]">กรอกชื่อสถานที่เก็บใหม่</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          id="new-location-input"
                          value={newLocationInput}
                          onChange={(e) => setNewLocationInput(e.target.value)}
                          placeholder="เช่น ตึก B ชั้น 3 ข้างห้องไอที"
                          className="flex-1 px-3 py-2 bg-white border border-[#E8E8ED] rounded-lg text-xs font-sans text-[#1D1D1F] placeholder-[#86868B] focus:outline-hidden focus:border-[#000000] transition-all"
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
                          className="px-4 py-2 bg-[#000000] hover:bg-[#1D1D1F] text-white font-bold font-sans text-xs rounded-lg shadow-xs cursor-pointer select-none disabled:opacity-40"
                        >
                          บันทึก
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div className="bg-white p-4 rounded-2xl border border-[#E8E8ED] space-y-1.5 shadow-2xs">
                  <label className="block text-[10px] font-sans text-[#86868B] uppercase tracking-wider mb-1">หมายเหตุ / รายละเอียดสินค้าเพิ่มเติม</label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F5F5F7] border border-transparent rounded-xl text-xs font-sans text-[#1D1D1F] placeholder-[#86868B] focus:outline-hidden focus:bg-white focus:border-[#000000] focus:ring-4 focus:ring-[#000000]/10 transition-all duration-200"
                    placeholder="เช่น คุณสมบัติทางเทคนิค หมายเลขประจำเครื่อง (S/N) หรือข้อมูลสำคัญในการดูแล"
                  />
                </div>

                {/* Image Source Toggle and Upload Options */}
                <div className="bg-white p-4 rounded-2xl border border-[#E8E8ED] space-y-3.5 shadow-2xs">
                  <label className="block text-[10px] font-sans text-[#86868B] uppercase tracking-wider font-bold">ภาพประกอบรูปพัสดุ (Equipment Image)</label>
                  
                  <div className="grid grid-cols-2 p-1 bg-[#F5F5F7] rounded-xl border border-[#E8E8ED]">
                    <button
                      type="button"
                      onClick={() => {
                        setImageSourceMode('upload');
                        setUploadError('');
                      }}
                      className={`py-1.5 text-[10px] font-sans font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                        imageSourceMode === 'upload'
                          ? 'bg-white text-[#1D1D1F] shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
                          : 'text-[#86868B] hover:text-[#1D1D1F]'
                      }`}
                    >
                      📁 อัปโหลดไฟล์ภาพ
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setImageSourceMode('url');
                        setUploadError('');
                      }}
                      className={`py-1.5 text-[10px] font-sans font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                        imageSourceMode === 'url'
                          ? 'bg-white text-[#1D1D1F] shadow-[0_2px_8px_rgba(0,0,0,0.06)]'
                          : 'text-[#86868B] hover:text-[#1D1D1F]'
                      }`}
                    >
                      🌐 ใส่ลิงก์ URL ภาพ
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
                        className={`border border-dashed rounded-2xl p-5 text-center flex flex-col items-center justify-center transition-all ${
                          dragActive 
                            ? 'border-[#000000] bg-[#F5F5F7]/40' 
                            : imageUrl && imageUrl.startsWith('data:image')
                              ? 'border-[#1E7F28] bg-[#E5F9E0]/5'
                              : 'border-[#C5C5C7] hover:border-[#86868B] bg-[#F5F5F7]/30'
                        }`}
                      >
                        {imageUrl && imageUrl.startsWith('data:image') ? (
                          <div className="space-y-3 w-full flex flex-col items-center">
                            <div className="relative w-28 h-28 rounded-xl overflow-hidden border border-[#E8E8ED] bg-[#F5F5F7] shadow-xs flex items-center justify-center">
                              <img 
                                src={imageUrl} 
                                alt="Uploaded preview" 
                                className="w-full h-full object-contain p-1.5"
                              />
                              <button
                                type="button"
                                onClick={() => setImageUrl('')}
                                className="absolute top-1 right-1 bg-[#D12B2B] hover:bg-[#E53E3E] text-white p-1 rounded-full shadow-md transition cursor-pointer"
                                title="ลบรูปภาพ"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                            <span className="text-[9px] font-sans font-semibold text-[#1E7F28] bg-[#E5F9E0] px-2.5 py-0.5 rounded-full">
                              ✓ พร้อมบันทึกภาพอัปโหลดแล้ว
                            </span>
                            <label className="text-[10px] font-sans text-[#000000] hover:underline cursor-pointer font-bold">
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
                            <FileImage className={`h-8 w-8 mb-2 ${dragActive ? 'text-[#000000] animate-pulse' : 'text-[#86868B]'}`} />
                            <p className="text-xs font-sans text-[#1D1D1F] select-none">
                              ลากรูปภาพมาวางที่นี่ หรือ{' '}
                              <label className="text-[#000000] hover:underline cursor-pointer font-bold">
                                เลือกไฟล์จากเครื่อง
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  className="hidden" 
                                  onChange={handleFileChange} 
                                />
                              </label>
                            </p>
                            <p className="text-[9px] font-sans text-[#86868B] mt-1 select-none">
                              ไฟล์รูปภาพทุกประเภท ไม่เกิน 10MB (ระบบย่อรูปภาพให้ปลอดภัยอัตโนมัติ)
                            </p>
                          </>
                        )}
                      </div>

                      {uploadError && (
                        <p className="text-[10px] text-[#D12B2B] font-sans mt-1 bg-[#FEEBEB] p-2 rounded-lg border border-[#FEEBEB]/45 flex items-center gap-1">
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
                        className="w-full px-3.5 py-2.5 bg-[#F5F5F7] border border-transparent rounded-xl text-xs font-sans text-[#1D1D1F] placeholder-[#86868B] focus:outline-hidden focus:bg-white focus:border-[#000000] focus:ring-4 focus:ring-[#000000]/10 transition-all duration-200"
                        placeholder="กรอก URL รูปภาพ เช่น https://images.unsplash.com/..."
                      />
                      
                      {imageUrl && !imageUrl.startsWith('data:image') && (
                        <div className="flex items-center gap-3 bg-[#F5F5F7] p-2.5 rounded-xl border border-[#E8E8ED]">
                          <img 
                            src={imageUrl} 
                            alt="URL Preview" 
                            className="w-12 h-12 object-cover rounded-lg border border-[#E8E8ED] bg-white shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1557862921-37829c790f19?w=500&auto=format&fit=crop&q=80';
                            }}
                          />
                          <div className="text-left">
                            <div className="text-[9px] text-[#86868B] font-sans font-bold">ตัวอย่างรูปภาพลิงก์:</div>
                            <div className="text-[9px] text-[#1D1D1F] font-mono truncate max-w-[280px]">{imageUrl}</div>
                          </div>
                        </div>
                      )}

                      {/* Stock shortcuts */}
                      <div className="pt-1">
                        <span className="text-[9px] text-[#86868B] font-sans block mb-1">หรือเลือกภาพเทมเพลตด่วน:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {STOCK_IMAGES.map((img) => (
                            <button
                              key={img.name}
                              type="button"
                              onClick={() => setImageUrl(img.url)}
                              className="text-[9px] font-sans px-2.5 py-1 bg-[#F5F5F7] border border-[#E8E8ED] text-[#1D1D1F] rounded-lg hover:bg-[#E8E8ED] transition cursor-pointer"
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
              <div className="px-6 py-4 bg-white border-t border-[#E8E8ED] flex items-center justify-end space-x-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-[#C5C5C7] rounded-full text-xs font-sans font-semibold hover:bg-[#F5F5F7] text-[#1D1D1F] transition cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleSubmit}
                  className="px-5 py-2 bg-[#000000] hover:bg-[#1D1D1F] active:scale-95 text-white font-sans font-semibold text-xs rounded-full shadow-sm hover:shadow-md transition-all cursor-pointer"
                >
                  {formMode === 'create' ? 'ลงทะเบียนพัสดุ' : 'บันทึกการเปลี่ยนแปลง'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1D1D1F]/35 backdrop-blur-sm transition-opacity animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-[#E8E8ED] shadow-[0_20px_50px_rgba(0,0,0,0.15)] max-w-sm w-full p-6 text-left relative overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-[#D12B2B] mb-4">
              <div className="p-2.5 bg-[#FEEBEB] rounded-full">
                <Trash2 className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold font-sans text-[#1D1D1F]">ยืนยันต้องการลบพัสดุ?</h3>
            </div>
            
            <p className="text-xs text-[#86868B] font-sans leading-relaxed mb-6">
              คุณต้องการลบพัสดุอุปกรณ์ <strong className="text-[#1D1D1F] font-bold font-sans">"{deleteConfirmName}"</strong> ออกจากฐานข้อมูลคลังพัสดุถาวรใช่หรือไม่? ประวัติการเบิกจ่ายของสินค้านี้จะถูกยกเลิกด้วย
            </p>

            {deleteError && (
              <div className="mb-4 p-2.5 bg-[#FEEBEB] border border-transparent text-[#D12B2B] text-[10px] font-sans rounded-xl leading-relaxed">
                🚨 {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end space-x-2.5">
              <button
                type="button"
                onClick={() => { setDeleteConfirmId(null); setDeleteConfirmName(''); }}
                disabled={isDeleting}
                className="px-4 py-2 border border-[#C5C5C7] hover:bg-[#F5F5F7] text-[#1D1D1F] font-semibold font-sans text-xs rounded-full transition cursor-pointer select-none disabled:opacity-40"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2 bg-[#D12B2B] hover:bg-[#E53E3E] text-white font-bold font-sans text-xs rounded-full shadow-xs transition flex items-center gap-1.5 cursor-pointer select-none disabled:opacity-40"
              >
                {isDeleting ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>กำลังลบ...</span>
                  </>
                ) : (
                  <span>ใช่, ลบถาวรเลย</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
