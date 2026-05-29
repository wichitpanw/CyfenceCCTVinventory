/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Equipment, Transaction, SupabaseConfig, DashboardStats, SystemSettings, BorrowRequest, BorrowRequestItem } from '../types';

const STORAGE_KEY_CONFIG = 'item_inventory_supabase_config';
const STORAGE_KEY_EQUIPMENT = 'item_inventory_equipment_data';
const STORAGE_KEY_TRANSACTIONS = 'item_inventory_transactions_data';

// Initial Mocked Seed Data for Local Mode
const SEED_EQUIPMENT: Equipment[] = [
  {
    id: 'eq-import-001',
    code: 'CAM-DHA-2M',
    name: 'กล้อง 2M Dahua',
    category: 'กล้องวงจรปิด (CCTV)',
    status: 'available',
    location: 'คลังหลักสำนักงานใหญ่',
    description: 'กล้องวงจรปิดความละเอียด 2 ล้านพิกเซล ยี่ห้อ Dahua',
    image_url: 'https://images.unsplash.com/photo-1557862921-37829c790f19?w=500&auto=format&fit=crop&q=80',
    total_qty: 85,
    available_qty: 85,
    maintenance_qty: 0,
    broken_qty: 0,
    created_at: '2026-05-22T00:00:00Z'
  },
  {
    id: 'eq-import-002',
    code: 'CAM-HIK-2M',
    name: 'กล้อง 2M Hikvision',
    category: 'กล้องวงจรปิด (CCTV)',
    status: 'available',
    location: 'คลังหลักสำนักงานใหญ่',
    description: 'กล้องวงจรปิดความละเอียด 2 ล้านพิกเซล ยี่ห้อ Hikvision',
    image_url: 'https://images.unsplash.com/photo-1557862921-37829c790f19?w=500&auto=format&fit=crop&q=80',
    total_qty: 15,
    available_qty: 15,
    maintenance_qty: 0,
    broken_qty: 0,
    created_at: '2026-05-22T00:00:00Z'
  },
  {
    id: 'eq-import-003',
    code: 'CAM-PTZ-2M',
    name: 'กล้อง 2M (PTZ)',
    category: 'กล้องวงจรปิด (CCTV)',
    status: 'available',
    location: 'คลังหลักสำนักงานใหญ่',
    description: 'กล้องวงจรปิดความละเอียด 2 ล้านพิกเซล แบบหมุน-ก้ม-เงย-ซูมได้ (PTZ)',
    image_url: 'https://images.unsplash.com/photo-1557862921-37829c790f19?w=500&auto=format&fit=crop&q=80',
    total_qty: 10,
    available_qty: 10,
    maintenance_qty: 0,
    broken_qty: 0,
    created_at: '2026-05-22T00:00:00Z'
  },
  {
    id: 'eq-import-004',
    code: 'NVR-DHA-4CH',
    name: 'NVR Dahua 4CH',
    category: 'เครื่องบันทึกและระบบเก็บข้อมูล',
    status: 'available',
    location: 'คลังเครื่องบันทึก',
    description: 'เครื่องบันทึก NVR ยี่ห้อ Dahua ขนาด 4 ช่องสัญญาณ (Channels)',
    image_url: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=500&auto=format&fit=crop&q=80',
    total_qty: 40,
    available_qty: 40,
    maintenance_qty: 0,
    broken_qty: 0,
    created_at: '2026-05-22T00:00:00Z'
  },
  {
    id: 'eq-import-005',
    code: 'NET-POE-4P',
    name: 'POE Switch 4 Ports',
    category: 'ระบบเครือข่ายเน็ตเวิร์ก',
    status: 'available',
    location: 'ห้องเครือข่าย',
    description: 'สวิตช์เครือข่ายชนิดส่งกระแสไฟผ่านสายแลน (PoE) จำนวน 4 พอร์ต',
    image_url: 'https://images.unsplash.com/photo-1530018607912-eff2df114f11?w=500&auto=format&fit=crop&q=80',
    total_qty: 55,
    available_qty: 55,
    maintenance_qty: 0,
    broken_qty: 0,
    created_at: '2026-05-22T00:00:00Z'
  },
  {
    id: 'eq-import-006',
    code: 'CAB-OUT-LNK',
    name: 'Outdoor Rack (LINK)',
    category: 'ชั้นวางและตู้แร็ค (Cabinet)',
    status: 'available',
    location: 'โกดังเก็บตู้แร็ค',
    description: 'ตู้แร็คติดตั้งภายนอกอาคาร ยี่ห้อ LINK แท้ ทนแดดทนฝน',
    image_url: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=500&auto=format&fit=crop&q=80',
    total_qty: 35,
    available_qty: 35,
    maintenance_qty: 0,
    broken_qty: 0,
    created_at: '2026-05-22T00:00:00Z'
  },
  {
    id: 'eq-import-007',
    code: 'NET-RTR-3G4G',
    name: '3G/4G Router NT',
    category: 'ระบบเครือข่ายเน็ตเวิร์ก',
    status: 'available',
    location: 'ตู้พักงานระบบ',
    description: 'เราเตอร์รับสัญญาณโทรศัพท์มือถือ 3G/4G สังกัดค่าย NT',
    image_url: 'https://images.unsplash.com/photo-1530018607912-eff2df114f11?w=500&auto=format&fit=crop&q=80',
    total_qty: 2,
    available_qty: 2,
    maintenance_qty: 0,
    broken_qty: 0,
    created_at: '2026-05-22T00:00:00Z'
  },
  {
    id: 'eq-import-008',
    code: 'CAB-OUT-SML',
    name: 'Outdoor Rack (เล็ก)',
    category: 'ชั้นวางและตู้แร็ค (Cabinet)',
    status: 'available',
    location: 'โกดังเก็บตู้แร็ค',
    description: 'ตู้แร็คติดตั้งภายนอกขนาดเล็กกะทัดร้อย',
    image_url: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=500&auto=format&fit=crop&q=80',
    total_qty: 3,
    available_qty: 3,
    maintenance_qty: 0,
    broken_qty: 0,
    created_at: '2026-05-22T00:00:00Z'
  },
  {
    id: 'eq-import-009',
    code: 'CAB-OUT-WDN',
    name: 'Outdoor Rack (WIDEN)',
    category: 'ชั้นวางและตู้แร็ค (Cabinet)',
    status: 'available',
    location: 'โกดังเก็บตู้แร็ค',
    description: 'ตู้แร็คติดตั้งภายนอกอาคาร ยี่ห้อ WIDEN แข็งแกร่งทนทานสูงสุด',
    image_url: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=500&auto=format&fit=crop&q=80',
    total_qty: 20,
    available_qty: 20,
    maintenance_qty: 0,
    broken_qty: 0,
    created_at: '2026-05-22T00:00:00Z'
  },
  {
    id: 'eq-import-010',
    code: 'PC-PD-STD',
    name: 'PC ภด.',
    category: 'จอภาพและอุปกรณ์คอมพิวเตอร์',
    status: 'available',
    location: 'ห้องจัดเตรียมอุปกรณ์คอมพิวเตอร์',
    description: 'เครื่องคอมพิวเตอร์ส่วนบุคคล (PC) สำหรับแผนกและงาน ภด.',
    image_url: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500&auto=format&fit=crop&q=80',
    total_qty: 8,
    available_qty: 8,
    maintenance_qty: 0,
    broken_qty: 0,
    created_at: '2026-05-22T00:00:00Z'
  },
  {
    id: 'eq-import-011',
    code: 'CTRL-CCTV-SYS',
    name: 'ชุดควบคุมกล้องวงจรปิด',
    category: 'เครื่องบันทึกและระบบเก็บข้อมูล',
    status: 'available',
    location: 'ห้องคอนโทรลรูม ชั้น 2',
    description: 'ชุดควบคุมและสั่งงานกล้องวงจรปิดกลางแบบคอนโซล',
    image_url: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=500&auto=format&fit=crop&q=80',
    total_qty: 1,
    available_qty: 1,
    maintenance_qty: 0,
    broken_qty: 0,
    created_at: '2026-05-22T00:00:00Z'
  },
  {
    id: 'eq-import-012',
    code: 'MON-PD-27',
    name: 'จอ 27" ภด.',
    category: 'จอภาพและอุปกรณ์คอมพิวเตอร์',
    status: 'available',
    location: 'ห้องจัดเตรียมอุปกรณ์คอมพิวเตอร์',
    description: 'จอมอนิเตอร์แสดงภาพขนาด 27 นิ้ว สำหรับแผนก ภด.',
    image_url: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500&auto=format&fit=crop&q=80',
    total_qty: 8,
    available_qty: 8,
    maintenance_qty: 0,
    broken_qty: 0,
    created_at: '2026-05-22T00:00:00Z'
  },
  {
    id: 'eq-import-013',
    code: 'MON-DE-27',
    name: 'จอ 27" DE',
    category: 'จอภาพและอุปกรณ์คอมพิวเตอร์',
    status: 'available',
    location: 'ห้องคอมพิวเตอร์คลังกลาง',
    description: 'จอมอนิเตอร์แสดงภาพขนาด 27 นิ้ว ยี่ห้อ Dell / DE คุณภาพสูง',
    image_url: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500&auto=format&fit=crop&q=80',
    total_qty: 22,
    available_qty: 22,
    maintenance_qty: 0,
    broken_qty: 0,
    created_at: '2026-05-22T00:00:00Z'
  },
  {
    id: 'eq-import-014',
    code: 'NVR-UNV-8CH',
    name: 'NVR UNV 8CH',
    category: 'เครื่องบันทึกและระบบเก็บข้อมูล',
    status: 'available',
    location: 'คลังเครื่องบันทึก',
    description: 'เครื่องบันทึก NVR ยี่ห้อ Uniview (UNV) ขนาด 8 ช่องสัญญาณความน่าเชื่อถือสูง',
    image_url: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=500&auto=format&fit=crop&q=80',
    total_qty: 24,
    available_qty: 24,
    maintenance_qty: 0,
    broken_qty: 0,
    created_at: '2026-05-22T00:00:00Z'
  },
  {
    id: 'eq-import-015',
    code: 'CAM-UNV-5M',
    name: 'กล้อง 5M UNV',
    category: 'กล้องวงจรปิด (CCTV)',
    status: 'available',
    location: 'คลังหลักสำนักงานใหญ่',
    description: 'กล้องวงจรปิด Uniview (UNV) ความละเอียดสูงพิเศษ 5 ล้านพิกเซล',
    image_url: 'https://images.unsplash.com/photo-1557862921-37829c790f19?w=500&auto=format&fit=crop&q=80',
    total_qty: 168,
    available_qty: 168,
    maintenance_qty: 0,
    broken_qty: 0,
    created_at: '2026-05-22T00:00:00Z'
  },
  {
    id: 'eq-import-016',
    code: 'PWR-UPS-800',
    name: 'UPS 800 VA',
    category: 'แหล่งจ่ายไฟและอุปกรณ์สำรอง',
    status: 'available',
    location: 'ห้องอุปกรณ์กำลังไฟ',
    description: 'เครื่องสำรองไฟฟ้าเสถียรภาพสูง ขนาดกำลังไฟ 800 VA สำหรับป้องกันกล้องวงจรปิดดับ',
    image_url: 'https://images.unsplash.com/photo-1584286595398-a59f21d313f5?w=500&auto=format&fit=crop&q=80',
    total_qty: 24,
    available_qty: 24,
    maintenance_qty: 0,
    broken_qty: 0,
    created_at: '2026-05-22T00:00:00Z'
  },
  {
    id: 'eq-import-017',
    code: 'CAM-UNV-2M',
    name: 'กล้อง 2M UNV',
    category: 'กล้องวงจรปิด (CCTV)',
    status: 'available',
    location: 'คลังหลักสำนักงานใหญ่',
    description: 'กล้องวงจรปิด Uniview (UNV) ความละเอียดคมชัด 2 ล้านพิกเซล',
    image_url: 'https://images.unsplash.com/photo-1557862921-37829c790f19?w=500&auto=format&fit=crop&q=80',
    total_qty: 72,
    available_qty: 72,
    maintenance_qty: 0,
    broken_qty: 0,
    created_at: '2026-05-22T00:00:00Z'
  },
  {
    id: 'eq-import-018',
    code: 'MON-DE-19',
    name: 'จอ 19" DE',
    category: 'จอภาพและอุปกรณ์คอมพิวเตอร์',
    status: 'available',
    location: 'ห้องคอมพิวเตอร์คลังกลาง',
    description: 'จอมอนิเตอร์ขนาดกะทัดรัด 19 นิ้ว ยี่ห้อ DE/Dell สำหรับจอสังเกตการณ์ระบบ',
    image_url: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500&auto=format&fit=crop&q=80',
    total_qty: 60,
    available_qty: 60,
    maintenance_qty: 0,
    broken_qty: 0,
    created_at: '2026-05-22T00:00:00Z'
  },
  {
    id: 'eq-import-019',
    code: 'AUD-SPK-GEN',
    name: 'ลำโพง',
    category: 'จอภาพและอุปกรณ์คอมพิวเตอร์',
    status: 'available',
    location: 'ห้องควบคุมระบบสื่อสาร',
    description: 'ลำโพงขยายเสียงสำหรับระบบประกาศและห้องประมวลผล',
    image_url: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500&auto=format&fit=crop&q=80',
    total_qty: 24,
    available_qty: 24,
    maintenance_qty: 0,
    broken_qty: 0,
    created_at: '2026-05-22T00:00:00Z'
  },
  {
    id: 'eq-import-020',
    code: 'PC-DE-LRG',
    name: 'PC ใหญ่ DE',
    category: 'จอภาพและอุปกรณ์คอมพิวเตอร์',
    status: 'available',
    location: 'ห้องเวิร์กสเตชัน ชั้น 2',
    description: 'คอมพิวเตอร์ส่วนบุคคล ตู้อัลตร้าคอร์ระดับเคสใหญ่ ยี่ห้อ DE/Dell มีสมรรถนะสูง',
    image_url: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500&auto=format&fit=crop&q=80',
    total_qty: 22,
    available_qty: 22,
    maintenance_qty: 0,
    broken_qty: 0,
    created_at: '2026-05-22T00:00:00Z'
  },
  {
    id: 'eq-import-021',
    code: 'NET-POE-8P',
    name: 'POE Switch 8 Ports',
    category: 'ระบบเครือข่ายเน็ตเวิร์ก',
    status: 'available',
    location: 'ห้องเครือข่าย',
    description: 'สวิตช์เครือข่าย PoE ยี่ห้อเสถียร ขนาด 8 พอร์ต สำหรับเชื่อมต่อไฟลากยาว',
    image_url: 'https://images.unsplash.com/photo-1530018607912-eff2df114f11?w=500&auto=format&fit=crop&q=80',
    total_qty: 24,
    available_qty: 24,
    maintenance_qty: 0,
    broken_qty: 0,
    created_at: '2026-05-22T00:00:00Z'
  },
  {
    id: 'eq-import-022',
    code: 'CAB-OUT-STD',
    name: 'Outdoor Rack',
    category: 'ชั้นวางและตู้แร็ค (Cabinet)',
    status: 'available',
    location: 'โกดังเก็บตู้แร็ค',
    description: 'ตู้แร็คมาตรฐานใช้งานจัดตั้งนอกอาคารระบายความร้อนในตัว',
    image_url: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=500&auto=format&fit=crop&q=80',
    total_qty: 24,
    available_qty: 24,
    maintenance_qty: 0,
    broken_qty: 0,
    created_at: '2026-05-22T00:00:00Z'
  },
  {
    id: 'eq-import-023',
    code: 'PC-DE-SML',
    name: 'PC เล็ก DE',
    category: 'จอภาพและอุปกรณ์คอมพิวเตอร์',
    status: 'available',
    location: 'ห้องเวิร์กสเตชัน ชั้น 2',
    description: 'คอมพิวเตอร์เคสเล็กประหยัดเนื้อที่การติดตั้ง ยี่ห้อ DE/Dell ขีดขวัญเสถียรภาพ',
    image_url: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500&auto=format&fit=crop&q=80',
    total_qty: 60,
    available_qty: 60,
    maintenance_qty: 0,
    broken_qty: 0,
    created_at: '2026-05-22T00:00:00Z'
  },
  {
    id: 'eq-import-024',
    code: 'CAM-UNV-SAM-5M',
    name: 'กล้อง 5M UNV SAMCOM',
    category: 'กล้องวงจรปิด (CCTV)',
    status: 'available',
    location: 'คลังสินค้าพิเศษ SAMCOM',
    description: 'กล้องวงจรปิด Uniview 5 ล้านพิกเซล สำหรับงานกลุ่มโครงการเฉพาะ SAMCOM',
    image_url: 'https://images.unsplash.com/photo-1557862921-37829c790f19?w=500&auto=format&fit=crop&q=80',
    total_qty: 200,
    available_qty: 200,
    maintenance_qty: 0,
    broken_qty: 0,
    created_at: '2026-05-22T00:00:00Z'
  },
  {
    id: 'eq-import-025',
    code: 'CAM-PTZ-SAM-2M',
    name: 'กล้อง PTZ UNV SAMCOM',
    category: 'กล้องวงจรปิด (CCTV)',
    status: 'available',
    location: 'คลังสินค้าพิเศษ SAMCOM',
    description: 'กล้อง PTZ ยี่ห้อ Uniview หมุนส่ายซูมได้สำหรับโครงการเฉพาะ SAMCOM',
    image_url: 'https://images.unsplash.com/photo-1557862921-37829c790f19?w=500&auto=format&fit=crop&q=80',
    total_qty: 15,
    available_qty: 15,
    maintenance_qty: 0,
    broken_qty: 0,
    created_at: '2026-05-22T00:00:00Z'
  },
  {
    id: 'eq-import-026',
    code: 'NVR-UNV-SAM-8C',
    name: 'NVR UNV 8CH SAMCOM',
    category: 'เครื่องบันทึกและระบบเก็บข้อมูล',
    status: 'available',
    location: 'คลังสินค้าพิเศษ SAMCOM',
    description: 'เครื่องบันทึก Uniview NVR ขนาด 8 ช่องสัญญาณสำหรับโครงการเฉพาะ SAMCOM',
    image_url: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=500&auto=format&fit=crop&q=80',
    total_qty: 60,
    available_qty: 60,
    maintenance_qty: 0,
    broken_qty: 0,
    created_at: '2026-05-22T00:00:00Z'
  }
];

const SEED_TRANSACTIONS: Transaction[] = [];

let supabaseInstance: SupabaseClient | null = null;

// Initialize Supabase Client dynamically
export function getSupabaseClient(config: SupabaseConfig): SupabaseClient | null {
  if (config.useLocalStorage || !config.supabaseUrl || !config.supabaseKey) {
    supabaseInstance = null;
    return null;
  }
  
  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient(config.supabaseUrl, config.supabaseKey);
    } catch (e) {
      console.error('Failed to create Supabase client', e);
      supabaseInstance = null;
    }
  }
  return supabaseInstance;
}

// Get Database Configuration
export function getDbConfig(): SupabaseConfig {
  const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return {
        ...parsed,
        useLocalStorage: false // Force false since user explicitly requested to drop localstorage mode
      };
    } catch (e) {}
  }

  // Safe extraction of potential env variables set by the user
  const metaEnv = (import.meta as any).env || {};
  const envUrl = (metaEnv.VITE_SUPABASE_URL as string) || '';
  const envKey = (metaEnv.VITE_SUPABASE_ANON_KEY as string) || '';

  return {
    supabaseUrl: envUrl,
    supabaseKey: envKey,
    useLocalStorage: false // Force false always
  };
}

// Save Database Configuration
export function saveDbConfig(config: SupabaseConfig): void {
  const updated = {
    ...config,
    useLocalStorage: false // Always override to false
  };
  localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(updated));
  supabaseInstance = null; // force recreation
}

// Helper to handle and format Supabase Column or Schema specific mismatch/stale errors
export function handleSupabaseError(error: any, context: string): never {
  const msg = error?.message || String(error);
  if (
    msg.toLowerCase().includes('available_qty') || 
    msg.toLowerCase().includes('total_qty') || 
    msg.toLowerCase().includes('maintenance_qty') || 
    msg.toLowerCase().includes('broken_qty') || 
    msg.toLowerCase().includes('borrow_qty') ||
    msg.toLowerCase().includes('evidence_image_url') ||
    msg.toLowerCase().includes('column') ||
    msg.toLowerCase().includes('schema cache')
  ) {
    throw new Error(
      `เกิดข้อผิดพลาดฐานข้อมูลยังไม่ถูกปรับปรุงสเกลจำนวน (${context}) [${msg}]: เนื่องจากตารางในบัญชี Supabase ของคุณยังเป็นโครงสร้างเดิมที่ขาดฟิลด์ควบคุมยอดรวม (เช่น available_qty) หรือคอลัมน์รูปหลักฐาน (เช่น evidence_image_url) ` +
      `กรุณาไปที่แท็บเมนู "ตั้งค่าแหล่งจัดเก็บข้อมูล" ในแอป คัดลอก "คำสั่ง SQL อัปเกรดตารางเดิมที่มีอยู่แล้ว" แล้วรันใน SQL Editor ของ Supabase เพื่ออัปเดตและกู้คืนระบบให้ใช้งานต่อได้ทันทีค่ะ!`
    );
  }
  throw new Error(`${context} ล้มเหลว: ${msg}`);
}

// Check database connection
export async function testDbConnection(config: SupabaseConfig): Promise<{ success: boolean; message: string }> {
  if (config.useLocalStorage) {
    return { success: true, message: 'เชื่อมต่อด้วยหน่วยความจำบราวเซอร์ (Local Storage) สำเร็จ' };
  }
  if (!config.supabaseUrl || !config.supabaseKey) {
    return { success: false, message: 'กรุณากรอก Supabase URL และ Key ให้ครบถ้วน' };
  }
  try {
    const client = createClient(config.supabaseUrl, config.supabaseKey);
    // Try to query schema
    const { error } = await client.from('equipment').select('count', { count: 'exact', head: true });
    
    if (error) {
      // If error is code missing or permissions, table might not exist but connection works,
      // let's try reading a dummy query to see if connection itself succeeds.
      if (error.code === 'PGRST116' || error.message.includes('not found') || error.message.includes('relation "equipment" does not exist')) {
        return { 
          success: true, 
          message: 'เชื่อมโยงกับโครงการกิ๊กใน Supabase ได้จริง! แต่ยังไม่สร้างโครงสร้างตาราง (Table "equipment" ยังไม่มี)' 
        };
      }
      return { success: false, message: `ตรวจพบบัญชีแต่พบข้อผิดพลาด: ${error.message} (Code: ${error.code})` };
    }
    
    return { success: true, message: 'เชื่อมต่อและพบตารางใน Supabase เรียบร้อยแล้ว พร้อมใช้งานระดับสูง!' };
  } catch (err: any) {
    return { success: false, message: `การเชื่อมต่อขัดข้อง: ${err?.message || 'โปรดตรวจสอบความถูกต้องของ URL/Key'}` };
  }
}

// --- Data Fetching Operations ---

// Equipments Fetch
export async function getEquipments(config: SupabaseConfig): Promise<Equipment[]> {
  const client = getSupabaseClient(config);
  
  if (client) {
    try {
      const { data, error } = await client
        .from('equipment')
        .select('*')
        .order('code', { ascending: true });
        
      if (!error && data) {
        return (data as any[]).map(item => ({
          ...item,
          total_qty: item.total_qty ?? 1,
          available_qty: item.available_qty ?? (item.status === 'borrowed' ? 0 : 1),
          maintenance_qty: item.maintenance_qty ?? (item.status === 'maintenance' ? 1 : 0),
          broken_qty: item.broken_qty ?? (item.status === 'broken' ? 1 : 0),
        })) as Equipment[];
      }
      console.warn('Supabase fetch failed, rolling to local array:', error);
    } catch (err) {
      console.error('Error fetching from Supabase', err);
    }
  }

  // Local Database Fallback
  const stored = localStorage.getItem(STORAGE_KEY_EQUIPMENT);
  if (!stored || !stored.includes('eq-import-001')) {
    localStorage.setItem(STORAGE_KEY_EQUIPMENT, JSON.stringify(SEED_EQUIPMENT));
    localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify([]));
    return SEED_EQUIPMENT;
  }
  try {
    const parsed = JSON.parse(stored) as any[];
    return parsed.map(item => ({
      ...item,
      total_qty: item.total_qty ?? 1,
      available_qty: item.available_qty ?? (item.status === 'borrowed' ? 0 : 1),
      maintenance_qty: item.maintenance_qty ?? (item.status === 'maintenance' ? 1 : 0),
      broken_qty: item.broken_qty ?? (item.status === 'broken' ? 1 : 0),
    })) as Equipment[];
  } catch (e) {
    return SEED_EQUIPMENT;
  }
}

// Transactions Fetch
export async function getTransactions(config: SupabaseConfig): Promise<Transaction[]> {
  const client = getSupabaseClient(config);
  
  if (client) {
    try {
      const { data, error } = await client
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (!error && data) {
        // Dynamically recalculate "overdue" if still "borrowing" and due_date < current_time
        const now = new Date();
        const recalculated = data.map((tx: any) => {
          let recStatus = tx.status;
          if (tx.status === 'borrowing' && new Date(tx.due_date) < now) {
            recStatus = 'overdue';
          }
          return {
            ...tx,
            status: recStatus,
            borrow_qty: tx.borrow_qty ?? 1
          };
        });
        return recalculated as Transaction[];
      }
      console.warn('Supabase fetch transactions failed, rolling to local:', error);
    } catch (err) {
      console.error('Error fetching transactions from Supabase', err);
    }
  }

  // Local Database Fallback
  const stored = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);
  if (!stored) {
    localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(SEED_TRANSACTIONS));
    return SEED_TRANSACTIONS;
  }
  try {
    const list = JSON.parse(stored) as any[];
    const now = new Date();
    // recalculate overdue for mock data
    return list.map(tx => {
      let recStatus = tx.status;
      if (tx.status === 'borrowing' && new Date(tx.due_date) < now) {
        recStatus = 'overdue';
      }
      return {
        ...tx,
        status: recStatus,
        borrow_qty: tx.borrow_qty ?? 1
      };
    }) as Transaction[];
  } catch (e) {
    return SEED_TRANSACTIONS;
  }
}

// --- CRUD Operations ---

// Add Equipment
export async function addEquipment(config: SupabaseConfig, item: Omit<Equipment, 'id' | 'created_at'>): Promise<Equipment> {
  const newId = `eq-${Date.now()}`;
  const newItem: Equipment = {
    ...item,
    id: newId,
    created_at: new Date().toISOString(),
  };

  const client = getSupabaseClient(config);
  if (client) {
    try {
      // In Supabase, if the schema is UUID for 'id', we let Supabase handle or convert.
      // To bypass UUID issues, we insert with newId. If table has auto-increment or uuid, 
      // it might crash if we pass string. So let's delete id from insert if it's generated,
      // or standard string if schema uses VARCHAR/TEXT for pk.
      // We will assume schema uses VARCHAR/TEXT for 'id' to be highly flexible for both.
      const { data, error } = await client
        .from('equipment')
        .insert([newItem])
        .select();
        
      if (!error && data && data[0]) {
        return data[0] as Equipment;
      }
      if (error) {
        throw error;
      }
    } catch (err: any) {
      console.error('Error adding equipment in Supabase', err);
      handleSupabaseError(err, 'ลงทะเบียนอุปกรณ์ใหม่');
    }
  }

  // Local database fallback
  const items = await getEquipments(config);
  items.push(newItem);
  localStorage.setItem(STORAGE_KEY_EQUIPMENT, JSON.stringify(items));
  return newItem;
}

// Update Equipment Info
export async function updateEquipment(config: SupabaseConfig, item: Equipment): Promise<Equipment> {
  const client = getSupabaseClient(config);
  if (client) {
    try {
      const { data, error } = await client
        .from('equipment')
        .update(item)
        .eq('id', item.id)
        .select();
        
      if (!error && data && data[0]) {
        return data[0] as Equipment;
      }
      if (error) {
        throw error;
      }
    } catch (err: any) {
      console.error('Error updating equipment', err);
      handleSupabaseError(err, 'บันทึกแก้ไขอุปกรณ์');
    }
  }

  // Local database fallback
  const items = await getEquipments(config);
  const index = items.findIndex(x => x.id === item.id);
  if (index !== -1) {
    items[index] = item;
    localStorage.setItem(STORAGE_KEY_EQUIPMENT, JSON.stringify(items));
    return item;
  }
  throw new Error('ไม่พบข้อมูลอุปกรณ์เพื่อแก้ไข');
}

// Delete Equipment
export async function deleteEquipment(config: SupabaseConfig, id: string): Promise<boolean> {
  const client = getSupabaseClient(config);
  if (client) {
    try {
      // 1. Delete associated transactions first to prevent foreign key reference constraint violation!
      const { error: rxError } = await client
        .from('transactions')
        .delete()
        .eq('equipment_id', id);
        
      if (rxError) {
        console.warn('Silent warning: Failed to cascade delete transactions', rxError);
      }

      // 2. Now delete the equipment safely!
      const { error } = await client
        .from('equipment')
        .delete()
        .eq('id', id);
        
      if (error) {
        throw new Error(error.message);
      }
      return true;
    } catch (err: any) {
      console.error('Error deleting equipment in Supabase', err);
      throw err;
    }
  }

  // Local database fallback
  const items = await getEquipments(config);
  const filtered = items.filter(x => x.id !== id);
  localStorage.setItem(STORAGE_KEY_EQUIPMENT, JSON.stringify(filtered));
  return true;
}

// --- Transaction Specific Operations (Borrow/Return) ---

// Borrow Equipment (สร้างประวัติเบิก และ เปลี่ยนสถานะเครื่องเป็น borrowed)
export async function borrowEquipment(
  config: SupabaseConfig,
  equipment: Equipment,
  params: {
    borrowerName: string;
    borrowerDepartment: string;
    purpose: string;
    dueDate: string;
    borrowQty: number;
    borrowDate?: string;
    evidenceImageUrl?: string;
  }
): Promise<Transaction> {
  const nowStr = new Date().toISOString();
  const bDate = params.borrowDate ? new Date(params.borrowDate).toISOString() : nowStr;
  const borrowQty = params.borrowQty || 1;
  
  const randStr = Math.random().toString(36).substring(2, 7);
  const newTx: Transaction = {
    id: `tx-${Date.now()}-${randStr}`,
    equipment_id: equipment.id,
    equipment_code: equipment.code,
    equipment_name: equipment.name,
    borrower_name: params.borrowerName,
    borrower_department: params.borrowerDepartment,
    borrow_date: bDate,
    due_date: new Date(params.dueDate).toISOString(),
    return_date: null,
    purpose: params.purpose,
    status: 'borrowing',
    borrow_qty: borrowQty,
    evidence_image_url: params.evidenceImageUrl || undefined,
    created_at: nowStr,
  };

  const client = getSupabaseClient(config);
  if (client) {
    try {
      // Step 1: ดึงรายละเอียดล่าช้าเพื่อเช็กจำนวน
      const { data: eqData, error: eqFetchErr } = await client
        .from('equipment')
        .select('*')
        .eq('id', equipment.id);
        
      if (eqFetchErr || !eqData || eqData.length === 0) {
        throw new Error('ไม่พบข้อมูลอุปกรณ์นี้บนระบบเซิร์ฟเวอร์');
      }
      
      const currentEq = eqData[0];
      const availableQty = currentEq.available_qty ?? (currentEq.status === 'borrowed' ? 0 : 1);
      
      if (availableQty < borrowQty) {
        throw new Error(`อุปกรณ์คงคลังไม่เพียงพอ (คงเหลืออยู่ ${availableQty} ชิ้น แต่ยื่นขอเบิก ${borrowQty} ชิ้น)`);
      }

      // Step 2: บันทึกประวัติเบิกยืม
      const { data: txData, error: txErr } = await client
        .from('transactions')
        .insert([newTx])
        .select();

      if (txErr) {
        throw new Error(`การบันทึกรายการยืมล้มเหลว: ${txErr.message}`);
      }

      // Step 3: หักจำนวนคงเหลือ และ อัปเดตสถานะของอุปกรณ์ ด้วยระบบตรวจสอบความสอดคล้องกัน (Atomic check)
      const nextAvailable = availableQty - borrowQty;
      const nextStatus = nextAvailable === 0 ? 'borrowed' : 'available';
      
      const { data: updatedEq, error: eqErr } = await client
        .from('equipment')
        .update({ 
          available_qty: nextAvailable,
          status: nextStatus
        })
        .eq('id', equipment.id)
        .gte('available_qty', borrowQty) // ตัวตรวจสอบระดับฐานข้อมูลป้องกันสภาวะแข่งขัน (Race Condition)
        .select();

      if (eqErr || !updatedEq || updatedEq.length === 0) {
        console.error('Supabase status update failed (out of stock or race condition), rolling back transactional state...');
        await client.from('transactions').delete().eq('id', newTx.id);
        throw new Error(eqErr?.message || 'อุปกรณ์มีจำนวนในคลังไม่เพียงพอ หรือมีการแย่งทำรายการเบิกไปก่อนหน้านี้');
      }

      return txData[0] as Transaction;
    } catch (err: any) {
      console.error('Error during Supabase borrow', err);
      handleSupabaseError(err, 'ทำรายการเบิกอุปกรณ์');
    }
  }

  // Local Database Fallback
  const items = await getEquipments(config);
  const txs = await getTransactions(config);

  const eqIndex = items.findIndex(x => x.id === equipment.id);
  if (eqIndex === -1) {
    throw new Error('ไม่พบข้อมูลอุปกรณ์ในระบบ');
  }

  const item = items[eqIndex];
  const availableQty = item.available_qty ?? (item.status === 'borrowed' ? 0 : 1);
  if (availableQty < borrowQty) {
    throw new Error(`อุปกรณ์คงคลังไม่เพียงพอ (คงเหลืออยู่ ${availableQty} ชิ้น แต่ยื่นขอเบิก ${borrowQty} ชิ้น)`);
  }

  // Update Status Local
  item.available_qty = availableQty - borrowQty;
  item.status = item.available_qty === 0 ? 'borrowed' : 'available';
  txs.unshift(newTx);

  localStorage.setItem(STORAGE_KEY_EQUIPMENT, JSON.stringify(items));
  localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(txs));

  return newTx;
}

// Return Equipment (บันทึกคืน และ เปลี่ยนสถานะเครื่องกลับเป็น available/maintenance/broken)
export async function returnEquipment(
  config: SupabaseConfig,
  transactionId: string,
  params: {
    conditionOnReturn: string;
    itemConditionStatus: 'available' | 'maintenance' | 'broken';
    returnQty?: number;
    returnDate?: string;
  }
): Promise<Transaction> {
  const returnDateStr = params.returnDate ? new Date(params.returnDate).toISOString() : new Date().toISOString();
  
  const client = getSupabaseClient(config);
  if (client) {
    try {
      // Step 1: ดึงรายละเอียดการคืนเพื่อรู้ว่ายืมอุปกรณ์อะไรอยู่
      const { data: txs, error: txFetchErr } = await client
        .from('transactions')
        .select('*')
        .eq('id', transactionId);

      if (txFetchErr || !txs || txs.length === 0) {
        throw new Error('ไม่พบประวัติรายการยืมนี้ในฐานข้อมูล');
      }

      const tx = txs[0] as Transaction;
      if (tx.status === 'returned') {
        throw new Error('รายการเบิกยืมนี้ระบุว่าได้ทำรายการคืนคลังเรียบร้อยแล้วก่อนหน้า');
      }

      const bQty = tx.borrow_qty ?? 1;
      const rQty = params.returnQty ?? bQty;

      if (rQty > bQty) {
        throw new Error(`ไม่สามารถคืนอุปกรณ์จำนวน ${rQty} ชิ้นได้ เนื่องจากมียอดค้างยืมเพียง ${bQty} ชิ้น`);
      }

      let finalReturnedTx: Transaction;

      // Step 2: อัปเดตตาราง Transactions
      if (rQty < bQty) {
        // Partial return: split transaction
        const remainingQty = bQty - rQty;
        const { error: txUpdateErr } = await client
          .from('transactions')
          .update({
            borrow_qty: remainingQty
          })
          .eq('id', transactionId);

        if (txUpdateErr) {
          throw new Error(`อัปเดตยอดคงค้างในรายการยืมล้มเหลว: ${txUpdateErr.message}`);
        }

        const randStr = Math.random().toString(36).substring(2, 7);
        const splitTx: Transaction = {
          ...tx,
          id: `tx-${Date.now()}-${randStr}`,
          borrow_qty: rQty,
          status: 'returned',
          return_date: returnDateStr,
          condition_on_return: params.conditionOnReturn,
          created_at: new Date().toISOString()
        };

        const { data: insertedTxData, error: insertTxErr } = await client
          .from('transactions')
          .insert([splitTx])
          .select();

        if (insertTxErr || !insertedTxData || !insertedTxData[0]) {
          throw new Error(`สร้างรายการแยกประวัติการคืนล้มเหลว: ${insertTxErr?.message}`);
        }

        finalReturnedTx = insertedTxData[0] as Transaction;
      } else {
        // Full return of transaction
        const { data: updatedTx, error: txErr } = await client
          .from('transactions')
          .update({
            return_date: returnDateStr,
            condition_on_return: params.conditionOnReturn,
            status: 'returned'
          })
          .eq('id', transactionId)
          .select();

        if (txErr || !updatedTx || !updatedTx[0]) {
          throw new Error(`อัปเดตรายการคืนล้มเหลว: ${txErr?.message}`);
        }

        finalReturnedTx = updatedTx[0] as Transaction;
      }

      // Step 3: ดึงข้อมูลอุปกรณ์ปัจจุบันเพื่อคำนวณจำนวน
      const { data: eqData, error: eqFetchErr } = await client
        .from('equipment')
        .select('*')
        .eq('id', tx.equipment_id);
        
      if (eqFetchErr || !eqData || eqData.length === 0) {
        throw new Error('ไม่พบข้อมูลตัวอุปกรณ์ในคลังระบบ');
      }
      
      const currentEq = eqData[0];
      let eqAvailable = currentEq.available_qty ?? 0;
      let eqMaintenance = currentEq.maintenance_qty ?? 0;
      let eqBroken = currentEq.broken_qty ?? 0;
      
      if (params.itemConditionStatus === 'available') {
        eqAvailable += rQty;
      } else if (params.itemConditionStatus === 'maintenance') {
        eqMaintenance += rQty;
      } else if (params.itemConditionStatus === 'broken') {
        eqBroken += rQty;
      }
      
      let nextStatus = currentEq.status;
      if (eqAvailable > 0) {
        nextStatus = 'available';
      } else if (eqMaintenance > 0) {
        nextStatus = 'maintenance';
      } else if (eqBroken > 0) {
        nextStatus = 'broken';
      } else {
        nextStatus = 'borrowed';
      }

      // Step 4: อัปเดตสถานะและจำนวนอุปกรณ์กลับไปที่คลัง
      const { error: eqErr } = await client
        .from('equipment')
        .update({ 
          available_qty: eqAvailable,
          maintenance_qty: eqMaintenance,
          broken_qty: eqBroken,
          status: nextStatus
        })
        .eq('id', tx.equipment_id);

      if (eqErr) {
        throw new Error(`คืนเรียบร้อยแต่อัปเดตอุปกรณ์ล้มเหลว: ${eqErr.message}`);
      }

      // Sync: Check if this transaction is associated with any borrow_requests, and update request status to 'returned' if all its transactions are returned
      try {
        const { data: relatedReqs, error: reqErr } = await client
          .from('borrow_requests')
          .select('*');
        if (!reqErr && relatedReqs) {
          for (const req of relatedReqs) {
            const txIds = Array.isArray(req.transaction_ids) 
              ? req.transaction_ids 
              : JSON.parse(req.transaction_ids || '[]');
            if (txIds.includes(transactionId)) {
              let updatedTxIds = [...txIds];
              let updatedItems = Array.isArray(req.items) ? req.items : JSON.parse(req.items || '[]');

              if (rQty < bQty) {
                updatedTxIds.push(finalReturnedTx.id);
              }

              updatedItems = updatedItems.map((item: any) => {
                if (item.equipment_id === tx.equipment_id) {
                  return {
                    ...item,
                    returned_qty: (item.returned_qty || 0) + rQty
                  };
                }
                return item;
              });

              // Fetch all transactions for this request
              const { data: requestTxs, error: fetchTxsErr } = await client
                .from('transactions')
                .select('id, status')
                .in('id', updatedTxIds);
              if (!fetchTxsErr && requestTxs) {
                const allReturned = requestTxs.every((t: any) => t.status === 'returned');
                await client
                  .from('borrow_requests')
                  .update({ 
                    status: allReturned ? 'returned' : 'borrowing',
                    transaction_ids: updatedTxIds,
                    items: updatedItems,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', req.id);
              }
            }
          }
        }
      } catch (syncErr) {
        console.warn('Sync warning: Failed to sync return with borrow_request', syncErr);
      }

      return finalReturnedTx;
    } catch (err: any) {
      console.error('Error during Supabase return', err);
      handleSupabaseError(err, 'ทำรายการคืนคลังและประเมินสภาพ');
    }
  }

  // Local Database Fallback
  const items = await getEquipments(config);
  const txs = await getTransactions(config);

  const txIndex = txs.findIndex(x => x.id === transactionId);
  if (txIndex === -1) {
    throw new Error('ไม่พบประวัติรายการยืมนี้ในระบบ');
  }

  const tx = txs[txIndex];
  if (tx.status === 'returned') {
    throw new Error('รายการเบิกยืมนี้ระบุว่าได้ทำรายการคืนคลังเรียบร้อยแล้วก่อนหน้า');
  }

  const eqIndex = items.findIndex(x => x.id === tx.equipment_id);
  if (eqIndex === -1) {
    throw new Error('ไม่พบตัวอุปกรณ์ในฐานข้อมูล');
  }

  const item = items[eqIndex];
  const bQty = tx.borrow_qty ?? 1;
  const rQty = params.returnQty ?? bQty;

  if (rQty > bQty) {
    throw new Error(`ไม่สามารถคืนอุปกรณ์จำนวน ${rQty} ชิ้นได้ เนื่องจากมียอดค้างยืมเพียง ${bQty} ชิ้น`);
  }

  let finalTx: Transaction;

  if (rQty < bQty) {
    // Partial return: split
    const remainingQty = bQty - rQty;
    txs[txIndex].borrow_qty = remainingQty;

    const randStr = Math.random().toString(36).substring(2, 7);
    const splitTx: Transaction = {
      ...tx,
      id: `tx-${Date.now()}-${randStr}`,
      borrow_qty: rQty,
      status: 'returned',
      return_date: returnDateStr,
      condition_on_return: params.conditionOnReturn,
      created_at: new Date().toISOString()
    };
    txs.unshift(splitTx);
    finalTx = splitTx;
  } else {
    // Full return
    txs[txIndex] = {
      ...tx,
      return_date: returnDateStr,
      condition_on_return: params.conditionOnReturn,
      status: 'returned'
    };
    finalTx = txs[txIndex];
  }

  // Update Equipment Status & Quantities Local
  let eqAvailable = item.available_qty ?? 0;
  let eqMaintenance = item.maintenance_qty ?? 0;
  let eqBroken = item.broken_qty ?? 0;

  if (params.itemConditionStatus === 'available') {
    eqAvailable += rQty;
  } else if (params.itemConditionStatus === 'maintenance') {
    eqMaintenance += rQty;
  } else if (params.itemConditionStatus === 'broken') {
    eqBroken += rQty;
  }

  item.available_qty = eqAvailable;
  item.maintenance_qty = eqMaintenance;
  item.broken_qty = eqBroken;

  if (eqAvailable > 0) {
    item.status = 'available';
  } else if (eqMaintenance > 0) {
    item.status = 'maintenance';
  } else if (eqBroken > 0) {
    item.status = 'broken';
  } else {
    item.status = 'borrowed';
  }

  // Sync with borrow_requests locally if any
  try {
    const localReqsSaved = localStorage.getItem('borrow_requests_local');
    if (localReqsSaved) {
      const localReqs = JSON.parse(localReqsSaved) as BorrowRequest[];
      let updatedAny = false;
      for (const req of localReqs) {
        const txIds = req.transaction_ids || [];
        if (txIds.includes(transactionId)) {
          let updatedTxIds = [...txIds];
          if (rQty < bQty) {
            updatedTxIds.push(finalTx.id);
          }
          req.transaction_ids = updatedTxIds;

          req.items = (req.items || []).map((ritem: any) => {
            if (ritem.equipment_id === tx.equipment_id) {
              return {
                ...ritem,
                returned_qty: (ritem.returned_qty || 0) + rQty
              };
            }
            return ritem;
          });

          // Check if all transactions are returned
          const reqTxs = txs.filter(t => updatedTxIds.includes(t.id));
          const allReturned = reqTxs.every(t => t.status === 'returned');
          req.status = allReturned ? 'returned' : 'borrowing';
          req.updated_at = new Date().toISOString();
          updatedAny = true;
        }
      }
      if (updatedAny) {
        localStorage.setItem('borrow_requests_local', JSON.stringify(localReqs));
      }
    }
  } catch (syncErr) {
    console.warn('Local storage sync returned fail', syncErr);
  }

  localStorage.setItem(STORAGE_KEY_EQUIPMENT, JSON.stringify(items));
  localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(txs));

  return finalTx;
}

// Seed starter demo data into a freshly connected Supabase database
export async function seedSupabaseData(config: SupabaseConfig, forceOverwrite = false): Promise<{ success: boolean; count: number; message: string }> {
  const client = getSupabaseClient(config);
  if (!client) {
    return { success: false, count: 0, message: 'ไม่ได้เลือกโหมดเซิร์ฟเวอร์ Supabase หรือยังไม่ได้ตั้งค่า API Credentials' };
  }

  try {
    // If force overwriting, clean the existing tables first!
    if (forceOverwrite) {
      // Delete from transactions first due to foreign keys constraint
      const { error: delTxErr } = await client
        .from('transactions')
        .delete()
        .neq('id', 'force-delete-all-key-placeholder'); // deletes all rows

      if (delTxErr && !delTxErr.message.includes('relation "transactions" does not exist')) {
        console.warn('Unable to clean transactions:', delTxErr);
      }

      const { error: delEqErr } = await client
        .from('equipment')
        .delete()
        .neq('id', 'force-delete-all-key-placeholder');

      if (delEqErr && !delEqErr.message.includes('relation "equipment" does not exist')) {
        console.warn('Unable to clean equipment:', delEqErr);
      }
    } else {
      // 1. Check if we already have equipments to avoid duplicate key violations or overwriting existing live data
      const { data: existing, error: checkErr } = await client
        .from('equipment')
        .select('id');

      if (checkErr) {
        throw checkErr;
      }

      if (existing && existing.length > 0) {
        return {
          success: false,
          count: existing.length,
          message: `ตารางอุปกรณ์ในระบบ Supabase ของท่านมีฐานข้อมูลจริงอยู่แล้วจำนวน ${existing.length} รายการ กรุณาใช้ตัวเลือก "เขียนทับข้อมูลทั้งหมด" หากแน่ใจว่าต้องการล้างคลังระบบแล้วใส่อุปกรณ์ 26 รายการใหม่`
        };
      }
    }

    // 2. Insert Core Equipment Seed Data
    const { error: equipInsertErr } = await client
      .from('equipment')
      .insert(SEED_EQUIPMENT);

    if (equipInsertErr) {
      throw new Error(`การบันทึกข้อมูลพัสดุเริ่มต้นล้มเหลว: ${equipInsertErr.message}`);
    }

    // 3. Insert Core Transaction History Seed Data
    const { error: txInsertErr } = await client
      .from('transactions')
      .insert(SEED_TRANSACTIONS);

    if (txInsertErr) {
      console.warn('Silent notice: transactions seed was skipped or failed', txInsertErr);
    }

    return {
      success: true,
      count: SEED_EQUIPMENT.length,
      message: `เตรียมข้อมูลสำเร็จ! นำเข้ารายการพัสดุจาก AppSheet จำนวน ${SEED_EQUIPMENT.length} รายการ ลงสู่ระบบและแสดงผลเรียลไทม์เรียบร้อยแล้ว`
    };
  } catch (err: any) {
    console.error('Failed to seed Supabase database', err);
    return {
      success: false,
      count: 0,
      message: `ไม่สามารถเขียนข้อมูล: ${err?.message || 'โปรดดูสคริปต์ว่าท่านได้รันสร้างตารางในหน้าแดชบอร์ด Supabase หรือยัง'}`
    };
  }
}

// Calculate Dashboard Stats
export async function getDashboardStats(config: SupabaseConfig): Promise<DashboardStats> {
  const items = await getEquipments(config);
  const txs = await getTransactions(config);
  
  let totalItems = 0;
  let availableItems = 0;
  let borrowedItems = 0;
  let maintenanceItems = 0;
  let brokenItems = 0;
  
  items.forEach(item => {
    const tQty = item.total_qty ?? 1;
    const aQty = item.available_qty ?? (item.status === 'borrowed' ? 0 : 1);
    const mQty = item.maintenance_qty ?? (item.status === 'maintenance' ? tQty : 0);
    const bQty = item.broken_qty ?? (item.status === 'broken' ? tQty : 0);
    const borrowedQty = tQty - aQty - mQty - bQty;
    
    totalItems += tQty;
    availableItems += aQty;
    borrowedItems += Math.max(0, borrowedQty);
    maintenanceItems += mQty;
    brokenItems += bQty;
  });
  
  const totalTransactions = txs.length;
  const activeBorrows = txs.filter(x => x.status === 'borrowing' || x.status === 'overdue').length;
  const overdueBorrows = txs.filter(x => x.status === 'overdue').length;

  return {
    totalItems,
    availableItems,
    borrowedItems,
    maintenanceItems,
    brokenItems,
    totalTransactions,
    activeBorrows,
    overdueBorrows
  };
}

// Fetch system settings
export async function getSystemSettings(config: SupabaseConfig): Promise<SystemSettings | null> {
  const client = getSupabaseClient(config);
  if (client) {
    try {
      const { data, error } = await client
        .from('system_settings')
        .select('*')
        .eq('id', 'default')
        .single();
      if (!error && data) {
        return data as SystemSettings;
      }
    } catch (e) {
      console.error('Error fetching system settings from Supabase:', e);
    }
  }
  return null;
}

// Save system settings
export async function saveSystemSettings(config: SupabaseConfig, settings: Omit<SystemSettings, 'id'>): Promise<void> {
  const client = getSupabaseClient(config);
  if (client) {
    try {
      const { error } = await client
        .from('system_settings')
        .upsert({
          id: 'default',
          ...settings,
          updated_at: new Date().toISOString()
        });
      if (error) throw error;
    } catch (e) {
      console.error('Error saving system settings to Supabase:', e);
      throw e;
    }
  }
}

// Send Telegram Notification
export async function sendTelegramNotification(token: string, chatId: string, message: string): Promise<boolean> {
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      })
    });
    return response.ok;
  } catch (e) {
    console.error('Failed to send Telegram notification:', e);
    return false;
  }
}

// --- Borrow Request (Approval Workflow) ---

// Get all borrow requests (for Admin)
export async function getBorrowRequests(config: SupabaseConfig): Promise<BorrowRequest[]> {
  const client = getSupabaseClient(config);
  if (client) {
    try {
      const { data, error } = await client
        .from('borrow_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        return data.map((r: any) => ({
          ...r,
          items: Array.isArray(r.items) ? r.items : JSON.parse(r.items || '[]'),
          transaction_ids: Array.isArray(r.transaction_ids) ? r.transaction_ids : JSON.parse(r.transaction_ids || '[]'),
        })) as BorrowRequest[];
      }
      if (error) console.warn('getBorrowRequests error:', error);
    } catch (e) {
      console.error('Error fetching borrow_requests:', e);
    }
  }
  // LocalStorage fallback
  try {
    const stored = localStorage.getItem('borrow_requests_local');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Create a new borrow request (Public — no auth needed)
export async function createBorrowRequest(
  config: SupabaseConfig,
  req: {
    requester_name: string;
    requester_company: string;
    requester_contact?: string;
    items: BorrowRequestItem[];
    purpose: string;
    requested_due_date: string;
    evidence_image_url?: string;
  }
): Promise<BorrowRequest> {
  const now = new Date().toISOString();
  const newReq: BorrowRequest = {
    id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    ...req,
    status: 'pending_approval',
    transaction_ids: [],
    created_at: now,
    updated_at: now,
  };

  const client = getSupabaseClient(config);
  if (client) {
    try {
      const { data, error } = await client
        .from('borrow_requests')
        .insert([newReq])
        .select();
      if (!error && data && data[0]) {
        const r = data[0] as any;
        return {
          ...r,
          items: Array.isArray(r.items) ? r.items : JSON.parse(r.items || '[]'),
          transaction_ids: Array.isArray(r.transaction_ids) ? r.transaction_ids : [],
        } as BorrowRequest;
      }
      if (error) throw error;
    } catch (err: any) {
      console.error('Error creating borrow_request in Supabase:', err);
      throw new Error(`ส่งคำขอไม่สำเร็จ: ${err?.message || 'โปรดลองใหม่'}`);
    }
  }

  // LocalStorage fallback
  const stored = localStorage.getItem('borrow_requests_local');
  const list: BorrowRequest[] = stored ? JSON.parse(stored) : [];
  list.unshift(newReq);
  localStorage.setItem('borrow_requests_local', JSON.stringify(list));
  return newReq;
}

// Update borrow request status (Admin action)
export async function updateBorrowRequestStatus(
  config: SupabaseConfig,
  id: string,
  status: BorrowRequest['status'],
  opts?: {
    adminNote?: string;
    reviewedBy?: string;
    transactionIds?: string[];
    evidenceImageUrl?: string;
  }
): Promise<BorrowRequest> {
  const now = new Date().toISOString();
  const patch: any = { status, updated_at: now };
  if (opts?.adminNote !== undefined) patch.admin_note = opts.adminNote;
  if (opts?.reviewedBy) {
    patch.reviewed_by = opts.reviewedBy;
    patch.reviewed_at = now;
  }
  if (opts?.transactionIds) patch.transaction_ids = opts.transactionIds;
  if (opts?.evidenceImageUrl) patch.evidence_image_url = opts.evidenceImageUrl;

  const client = getSupabaseClient(config);
  if (client) {
    try {
      // Sync: if status is updated to 'returned', update all associated transactions in Supabase too
      if (status === 'returned') {
        try {
          const { data: currentReq } = await client
            .from('borrow_requests')
            .select('transaction_ids, items')
            .eq('id', id)
            .single();
          if (currentReq) {
            const reqItems = Array.isArray(currentReq.items) ? currentReq.items : JSON.parse(currentReq.items || '[]');
            const updatedItems = reqItems.map((item: any) => ({
              ...item,
              returned_qty: item.qty
            }));
            patch.items = updatedItems;

            const txIds = Array.isArray(currentReq.transaction_ids)
              ? currentReq.transaction_ids
              : JSON.parse(currentReq.transaction_ids || '[]');
            if (txIds.length > 0) {
              const nowStr = new Date().toISOString();
              // Update all transactions of this request to 'returned'
              await client
                .from('transactions')
                .update({ 
                  return_date: nowStr, 
                  condition_on_return: 'คืนผ่านหน้าอนุมัติคำขอ (Admin)', 
                  status: 'returned' 
                })
                .in('id', txIds);

              // Also return quantities to equipment stock for each transaction
              const { data: txsData } = await client
                .from('transactions')
                .select('equipment_id, borrow_qty')
                .in('id', txIds);

              if (txsData) {
                for (const tx of txsData) {
                  const { data: eqData } = await client
                    .from('equipment')
                    .select('available_qty, total_qty')
                    .eq('id', tx.equipment_id)
                    .single();
                  if (eqData) {
                    const nextAvail = Math.min(eqData.total_qty, (eqData.available_qty ?? 0) + (tx.borrow_qty ?? 1));
                    await client
                      .from('equipment')
                      .update({ 
                        available_qty: nextAvail, 
                        status: nextAvail > 0 ? 'available' : 'borrowed' 
                      })
                      .eq('id', tx.equipment_id);
                  }
                }
              }
            }
          }
        } catch (syncErr) {
          console.warn('Sync transactions failed in request status update:', syncErr);
        }
      }

      const { data, error } = await client
        .from('borrow_requests')
        .update(patch)
        .eq('id', id)
        .select();
      if (!error && data && data[0]) {
        const r = data[0] as any;
        return {
          ...r,
          items: Array.isArray(r.items) ? r.items : JSON.parse(r.items || '[]'),
          transaction_ids: Array.isArray(r.transaction_ids) ? r.transaction_ids : [],
        } as BorrowRequest;
      }
      if (error) throw error;
    } catch (err: any) {
      console.error('Error updating borrow_request status:', err);
      handleSupabaseError(err, 'อัปเดตสถานะใบเบิก');
    }
  }

  // LocalStorage fallback
  const stored = localStorage.getItem('borrow_requests_local');
  const list: BorrowRequest[] = stored ? JSON.parse(stored) : [];
  const idx = list.findIndex(r => r.id === id);
  if (idx !== -1) {
    // Local fallback sync
    if (status === 'returned') {
      try {
        const txIds = list[idx].transaction_ids || [];
        const reqItems = list[idx].items || [];
        const updatedItems = reqItems.map((item: any) => ({
          ...item,
          returned_qty: item.qty
        }));
        list[idx].items = updatedItems;

        const localTxsSaved = localStorage.getItem('item_inventory_transactions_data');
        const localEqSaved = localStorage.getItem('item_inventory_equipment_data');
        if (localTxsSaved && localEqSaved) {
          const localTxs = JSON.parse(localTxsSaved);
          const localEq = JSON.parse(localEqSaved);
          txIds.forEach((tId: string) => {
            const tIdx = localTxs.findIndex((x: any) => x.id === tId);
            if (tIdx !== -1) {
              localTxs[tIdx].status = 'returned';
              localTxs[tIdx].return_date = now;
              localTxs[tIdx].condition_on_return = 'คืนผ่านหน้าอนุมัติคำขอ (Admin)';
              
              const eIdx = localEq.findIndex((x: any) => x.id === localTxs[tIdx].equipment_id);
              if (eIdx !== -1) {
                const nextAvail = (localEq[eIdx].available_qty ?? 0) + (localTxs[tIdx].borrow_qty ?? 1);
                localEq[eIdx].available_qty = nextAvail;
                localEq[eIdx].status = nextAvail > 0 ? 'available' : 'borrowed';
              }
            }
          });
          localStorage.setItem('item_inventory_transactions_data', JSON.stringify(localTxs));
          localStorage.setItem('item_inventory_equipment_data', JSON.stringify(localEq));
        }
      } catch (e) {
        console.warn('Local storage sync returned fail', e);
      }
    }
    list[idx] = { ...list[idx], ...patch };
    localStorage.setItem('borrow_requests_local', JSON.stringify(list));
    return list[idx];
  }
  throw new Error('ไม่พบคำขอที่ต้องการอัปเดต');
}

// Return items on a borrow request (Partial Return support)
export async function returnBorrowRequestItems(
  config: SupabaseConfig,
  requestId: string,
  params: {
    returnerName: string;
    itemsToReturn: {
      equipment_id: string;
      return_qty: number;
      condition: 'available' | 'maintenance' | 'broken';
      condition_on_return: string;
    }[];
    returnDate?: string;
  }
): Promise<BorrowRequest> {
  const returnDateStr = params.returnDate ? new Date(params.returnDate).toISOString() : new Date().toISOString();
  const client = getSupabaseClient(config);

  if (client) {
    try {
      // 1. Fetch current borrow request
      const { data: reqData, error: reqFetchErr } = await client
        .from('borrow_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (reqFetchErr || !reqData) {
        throw new Error('ไม่พบข้อมูลคำขอเบิกพัสดุนี้ในระบบ');
      }

      const req = {
        ...reqData,
        items: Array.isArray(reqData.items) ? reqData.items : JSON.parse(reqData.items || '[]'),
        transaction_ids: Array.isArray(reqData.transaction_ids) ? reqData.transaction_ids : JSON.parse(reqData.transaction_ids || '[]'),
      } as BorrowRequest;

      // 2. Fetch all transactions for this request
      const txIds = req.transaction_ids || [];
      const { data: txsData, error: txsFetchErr } = await client
        .from('transactions')
        .select('*')
        .in('id', txIds);

      if (txsFetchErr || !txsData) {
        throw new Error('ไม่พบข้อมูลรายการทำธุรกรรมยืมพัสดุนี้ในระบบ');
      }

      const txs = txsData as Transaction[];
      const newTxIds = [...txIds];

      // 3. For each return item input, process the return
      for (const retItem of params.itemsToReturn) {
        if (retItem.return_qty <= 0) continue;

        // Find the active transaction for this equipment
        const matchingTx = txs.find(t => t.equipment_id === retItem.equipment_id && t.status !== 'returned');
        if (!matchingTx) continue;

        const currentBorrowQty = matchingTx.borrow_qty ?? 1;
        const returnQty = retItem.return_qty;

        if (returnQty > currentBorrowQty) {
          throw new Error(`ไม่สามารถคืนอุปกรณ์จำนวน ${returnQty} ชิ้นได้ เนื่องจากมียอดค้างยืมเพียง ${currentBorrowQty} ชิ้น`);
        }

        // Return quantities to equipment stock
        const { data: eqData, error: eqFetchErr } = await client
          .from('equipment')
          .select('available_qty, total_qty, maintenance_qty, broken_qty, status')
          .eq('id', retItem.equipment_id)
          .single();

        if (eqFetchErr || !eqData) {
          throw new Error(`ไม่พบข้อมูลอุปกรณ์รหัส ${retItem.equipment_id} ในระบบคลัง`);
        }

        let eqAvailable = eqData.available_qty ?? 0;
        let eqMaintenance = eqData.maintenance_qty ?? 0;
        let eqBroken = eqData.broken_qty ?? 0;

        if (retItem.condition === 'available') {
          eqAvailable += returnQty;
        } else if (retItem.condition === 'maintenance') {
          eqMaintenance += returnQty;
        } else if (retItem.condition === 'broken') {
          eqBroken += returnQty;
        }

        let nextEqStatus = eqData.status;
        if (eqAvailable > 0) {
          nextEqStatus = 'available';
        } else if (eqMaintenance > 0) {
          nextEqStatus = 'maintenance';
        } else if (eqBroken > 0) {
          nextEqStatus = 'broken';
        } else {
          nextEqStatus = 'borrowed';
        }

        await client
          .from('equipment')
          .update({
            available_qty: eqAvailable,
            maintenance_qty: eqMaintenance,
            broken_qty: eqBroken,
            status: nextEqStatus
          })
          .eq('id', retItem.equipment_id);

        if (returnQty === currentBorrowQty) {
          // Full return for this transaction: just update the transaction status
          await client
            .from('transactions')
            .update({
              status: 'returned',
              return_date: returnDateStr,
              condition_on_return: retItem.condition_on_return || 'คืนพัสดุ (บางส่วน)'
            })
            .eq('id', matchingTx.id);
        } else {
          // Partial return for this transaction: split transaction!
          // A: Update current transaction borrow_qty
          const remainingQty = currentBorrowQty - returnQty;
          await client
            .from('transactions')
            .update({
              borrow_qty: remainingQty
            })
            .eq('id', matchingTx.id);

          // B: Create a new transaction representing the returned part
          const randStr = Math.random().toString(36).substring(2, 7);
          const newReturnedTx: Transaction = {
            ...matchingTx,
            id: `tx-${Date.now()}-${randStr}`,
            borrow_qty: returnQty,
            status: 'returned',
            return_date: returnDateStr,
            condition_on_return: retItem.condition_on_return || 'คืนพัสดุ (บางส่วน)',
            created_at: new Date().toISOString()
          };

          const { data: insertedTxData, error: insertTxErr } = await client
            .from('transactions')
            .insert([newReturnedTx])
            .select();

          if (insertTxErr || !insertedTxData || !insertedTxData[0]) {
            throw new Error(`สร้างรายการคืนพัสดุสะท้อนกลับล้มเหลว: ${insertTxErr?.message}`);
          }

          newTxIds.push(insertedTxData[0].id);
        }

        // Update returned_qty in req.items array
        const reqItem = req.items.find(i => i.equipment_id === retItem.equipment_id);
        if (reqItem) {
          reqItem.returned_qty = (reqItem.returned_qty || 0) + returnQty;
        }
      }

      // Check if all items in request are fully returned
      const allReturned = req.items.every(item => item.qty === (item.returned_qty || 0));
      const nextStatus = allReturned ? 'returned' : 'borrowing';

      // Update borrow_requests table
      const reviewerNameCombined = req.reviewed_by 
        ? `${req.reviewed_by.split(' | ผู้รับคืน: ')[0]} | ผู้รับคืน: ${params.returnerName}` 
        : `Admin | ผู้รับคืน: ${params.returnerName}`;

      const { data: updatedReqData, error: updateReqErr } = await client
        .from('borrow_requests')
        .update({
          status: nextStatus,
          items: req.items,
          transaction_ids: newTxIds,
          reviewed_by: reviewerNameCombined,
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId)
        .select();

      if (updateReqErr || !updatedReqData || !updatedReqData[0]) {
        throw new Error(`ไม่สามารถอัปเดตใบยืมได้: ${updateReqErr?.message}`);
      }

      const finalReq = updatedReqData[0] as any;
      return {
        ...finalReq,
        items: Array.isArray(finalReq.items) ? finalReq.items : JSON.parse(finalReq.items || '[]'),
        transaction_ids: Array.isArray(finalReq.transaction_ids) ? finalReq.transaction_ids : [],
      } as BorrowRequest;

    } catch (err: any) {
      console.error('Error in returnBorrowRequestItems Supabase:', err);
      handleSupabaseError(err, 'บันทึกรับคืนพัสดุบางส่วน');
    }
  }

  // LocalStorage Fallback
  try {
    const localReqsSaved = localStorage.getItem('borrow_requests_local');
    const localTxsSaved = localStorage.getItem('item_inventory_transactions_data');
    const localEqSaved = localStorage.getItem('item_inventory_equipment_data');

    if (localReqsSaved && localTxsSaved && localEqSaved) {
      const localReqs = JSON.parse(localReqsSaved) as BorrowRequest[];
      const localTxs = JSON.parse(localTxsSaved) as Transaction[];
      const localEq = JSON.parse(localEqSaved) as Equipment[];

      const reqIdx = localReqs.findIndex(r => r.id === requestId);
      if (reqIdx === -1) throw new Error('ไม่พบข้อมูลคำขอเบิกพัสดุในระบบ');

      const req = localReqs[reqIdx];
      const txIds = req.transaction_ids || [];

      for (const retItem of params.itemsToReturn) {
        if (retItem.return_qty <= 0) continue;

        const txIndex = localTxs.findIndex(t => txIds.includes(t.id) && t.equipment_id === retItem.equipment_id && t.status !== 'returned');
        if (txIndex === -1) continue;

        const currentBorrowQty = localTxs[txIndex].borrow_qty ?? 1;
        const returnQty = retItem.return_qty;

        if (returnQty > currentBorrowQty) {
          throw new Error(`ไม่สามารถคืนอุปกรณ์จำนวน ${returnQty} ชิ้นได้ เนื่องจากมียอดค้างยืมเพียง ${currentBorrowQty} ชิ้น`);
        }

        // Return quantities to equipment stock
        const eqIdx = localEq.findIndex(e => e.id === retItem.equipment_id);
        if (eqIdx !== -1) {
          let eqAvailable = localEq[eqIdx].available_qty ?? 0;
          let eqMaintenance = localEq[eqIdx].maintenance_qty ?? 0;
          let eqBroken = localEq[eqIdx].broken_qty ?? 0;

          if (retItem.condition === 'available') {
            eqAvailable += returnQty;
          } else if (retItem.condition === 'maintenance') {
            eqMaintenance += returnQty;
          } else if (retItem.condition === 'broken') {
            eqBroken += returnQty;
          }

          localEq[eqIdx].available_qty = eqAvailable;
          localEq[eqIdx].maintenance_qty = eqMaintenance;
          localEq[eqIdx].broken_qty = eqBroken;

          if (eqAvailable > 0) {
            localEq[eqIdx].status = 'available';
          } else if (eqMaintenance > 0) {
            localEq[eqIdx].status = 'maintenance';
          } else if (eqBroken > 0) {
            localEq[eqIdx].status = 'broken';
          } else {
            localEq[eqIdx].status = 'borrowed';
          }
        }

        if (returnQty === currentBorrowQty) {
          // Full return for this transaction
          localTxs[txIndex].status = 'returned';
          localTxs[txIndex].return_date = returnDateStr;
          localTxs[txIndex].condition_on_return = retItem.condition_on_return || 'คืนพัสดุ (บางส่วน)';
        } else {
          // Partial return: split
          const remainingQty = currentBorrowQty - returnQty;
          localTxs[txIndex].borrow_qty = remainingQty;

          const randStr = Math.random().toString(36).substring(2, 7);
          const newReturnedTx: Transaction = {
            ...localTxs[txIndex],
            id: `tx-${Date.now()}-${randStr}`,
            borrow_qty: returnQty,
            status: 'returned',
            return_date: returnDateStr,
            condition_on_return: retItem.condition_on_return || 'คืนพัสดุ (บางส่วน)',
            created_at: new Date().toISOString()
          };
          localTxs.unshift(newReturnedTx);
          req.transaction_ids = req.transaction_ids || [];
          req.transaction_ids.push(newReturnedTx.id);
        }

        // Update returned_qty in req.items
        const reqItem = req.items.find(i => i.equipment_id === retItem.equipment_id);
        if (reqItem) {
          reqItem.returned_qty = (reqItem.returned_qty || 0) + returnQty;
        }
      }

      // Check if all items in request are fully returned
      const allReturned = req.items.every(item => item.qty === (item.returned_qty || 0));
      req.status = allReturned ? 'returned' : 'borrowing';

      req.reviewed_by = req.reviewed_by 
        ? `${req.reviewed_by.split(' | ผู้รับคืน: ')[0]} | ผู้รับคืน: ${params.returnerName}` 
        : `Admin | ผู้รับคืน: ${params.returnerName}`;
      req.updated_at = new Date().toISOString();

      localStorage.setItem('borrow_requests_local', JSON.stringify(localReqs));
      localStorage.setItem('item_inventory_transactions_data', JSON.stringify(localTxs));
      localStorage.setItem('item_inventory_equipment_data', JSON.stringify(localEq));

      return req;
    }
  } catch (e: any) {
    console.error('LocalStorage returnBorrowRequestItems error:', e);
  }

  throw new Error('ไม่สามารถบันทึกรับคืนแบบบางส่วนได้ เนื่องจากระบบคลังขัดข้อง');
}

// Revert (pull back) all returned items of a borrow request back to borrowing status
export async function revertEntireBorrowRequestReturn(
  config: SupabaseConfig,
  requestId: string
): Promise<BorrowRequest> {
  const client = getSupabaseClient(config);

  if (client) {
    try {
      // 1. Fetch current borrow request
      const { data: reqData, error: reqFetchErr } = await client
        .from('borrow_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (reqFetchErr || !reqData) {
        throw new Error('ไม่พบข้อมูลคำขอเบิกพัสดุนี้ในระบบ');
      }

      const req = {
        ...reqData,
        items: Array.isArray(reqData.items) ? reqData.items : JSON.parse(reqData.items || '[]'),
        transaction_ids: Array.isArray(reqData.transaction_ids) ? reqData.transaction_ids : JSON.parse(reqData.transaction_ids || '[]'),
      } as BorrowRequest;

      // 2. Fetch all transactions for this request
      const txIds = req.transaction_ids || [];
      const { data: txsData, error: txsFetchErr } = await client
        .from('transactions')
        .select('*')
        .in('id', txIds);

      if (txsFetchErr || !txsData) {
        throw new Error('ไม่พบข้อมูลรายการทำธุรกรรมยืมพัสดุนี้ในระบบ');
      }

      const txs = txsData as Transaction[];
      const newTxIds = [...txIds];

      // Loop through each item in the request to revert their returns
      for (const reqItem of req.items) {
        const currentReturnedQty = reqItem.returned_qty !== undefined ? (reqItem.returned_qty || 0) : (req.status === 'returned' ? reqItem.qty : 0);
        if (currentReturnedQty <= 0) continue;

        const equipmentId = reqItem.equipment_id;

        // Find active and returned transactions for this equipment
        const activeTx = txs.find(t => t.equipment_id === equipmentId && t.status !== 'returned');
        const returnedTxs = txs.filter(t => t.equipment_id === equipmentId && t.status === 'returned')
                              .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

        let remainingRevertQty = currentReturnedQty;

        // Adjust transactions in database
        for (const retTx of returnedTxs) {
          if (remainingRevertQty <= 0) break;

          const returnedQtyInTx = retTx.borrow_qty ?? 0;
          const revertAmountFromThisTx = Math.min(remainingRevertQty, returnedQtyInTx);
          remainingRevertQty -= revertAmountFromThisTx;

          if (revertAmountFromThisTx === returnedQtyInTx) {
            if (activeTx) {
              await client.from('transactions').delete().eq('id', retTx.id);
              const idxToRemove = newTxIds.indexOf(retTx.id);
              if (idxToRemove !== -1) newTxIds.splice(idxToRemove, 1);
            } else {
              await client
                .from('transactions')
                .update({
                  status: 'borrowing',
                  return_date: null,
                  condition_on_return: null
                })
                .eq('id', retTx.id);
            }
          } else {
            await client
              .from('transactions')
              .update({
                borrow_qty: returnedQtyInTx - revertAmountFromThisTx
              })
              .eq('id', retTx.id);
          }
        }

        if (activeTx) {
          await client
            .from('transactions')
            .update({
              borrow_qty: (activeTx.borrow_qty ?? 0) + currentReturnedQty
            })
            .eq('id', activeTx.id);
        }

        // Deduct quantity from equipment stock
        const { data: eqData } = await client
          .from('equipment')
          .select('available_qty, status')
          .eq('id', equipmentId)
          .single();

        if (eqData) {
          const nextAvail = Math.max(0, (eqData.available_qty ?? 0) - currentReturnedQty);
          await client
            .from('equipment')
            .update({
              available_qty: nextAvail,
              status: nextAvail > 0 ? 'available' : 'borrowed'
            })
            .eq('id', equipmentId);
        }

        // Update returned_qty to 0
        reqItem.returned_qty = 0;
      }

      // Update borrow request status to 'borrowing'
      const { data: updatedReqData, error: updateReqErr } = await client
        .from('borrow_requests')
        .update({
          status: 'borrowing',
          items: req.items,
          transaction_ids: newTxIds,
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId)
        .select();

      if (updateReqErr || !updatedReqData || !updatedReqData[0]) {
        throw new Error(`ไม่สามารถอัปเดตใบยืมได้: ${updateReqErr?.message}`);
      }

      const finalReq = updatedReqData[0] as any;
      return {
        ...finalReq,
        items: Array.isArray(finalReq.items) ? finalReq.items : JSON.parse(finalReq.items || '[]'),
        transaction_ids: Array.isArray(finalReq.transaction_ids) ? finalReq.transaction_ids : [],
      } as BorrowRequest;

    } catch (err: any) {
      console.error('Error in revertEntireBorrowRequestReturn Supabase:', err);
      handleSupabaseError(err, 'ดึงใบเบิกกลับเป็นกำลังยืม');
    }
  }

  // LocalStorage Fallback
  try {
    const localReqsSaved = localStorage.getItem('borrow_requests_local');
    const localTxsSaved = localStorage.getItem('item_inventory_transactions_data');
    const localEqSaved = localStorage.getItem('item_inventory_equipment_data');

    if (localReqsSaved && localTxsSaved && localEqSaved) {
      const localReqs = JSON.parse(localReqsSaved) as BorrowRequest[];
      const localTxs = JSON.parse(localTxsSaved) as Transaction[];
      const localEq = JSON.parse(localEqSaved) as Equipment[];

      const reqIdx = localReqs.findIndex(r => r.id === requestId);
      if (reqIdx === -1) throw new Error('ไม่พบข้อมูลคำขอเบิกพัสดุในระบบ');

      const req = localReqs[reqIdx];

      for (const reqItem of req.items) {
        const currentReturnedQty = reqItem.returned_qty !== undefined ? (reqItem.returned_qty || 0) : (req.status === 'returned' ? reqItem.qty : 0);
        if (currentReturnedQty <= 0) continue;

        const equipmentId = reqItem.equipment_id;
        const txIds = req.transaction_ids || [];

        const activeTxIndex = localTxs.findIndex(t => txIds.includes(t.id) && t.equipment_id === equipmentId && t.status !== 'returned');
        const returnedTxIndices = localTxs
          .map((t, idx) => ({ t, idx }))
          .filter(x => txIds.includes(x.t.id) && x.t.equipment_id === equipmentId && x.t.status === 'returned')
          .sort((a, b) => new Date(b.t.created_at || 0).getTime() - new Date(a.t.created_at || 0).getTime())
          .map(x => x.idx);

        let remainingRevertQty = currentReturnedQty;

        for (const idx of returnedTxIndices) {
          if (remainingRevertQty <= 0) break;

          const returnedQtyInTx = localTxs[idx].borrow_qty ?? 0;
          const revertAmountFromThisTx = Math.min(remainingRevertQty, returnedQtyInTx);
          remainingRevertQty -= revertAmountFromThisTx;

          if (revertAmountFromThisTx === returnedQtyInTx) {
            if (activeTxIndex !== -1) {
              const txIdToDelete = localTxs[idx].id;
              localTxs.splice(idx, 1);
              req.transaction_ids = (req.transaction_ids || []).filter(id => id !== txIdToDelete);
            } else {
              localTxs[idx].status = 'borrowing';
              localTxs[idx].return_date = null;
              localTxs[idx].condition_on_return = undefined;
            }
          } else {
            localTxs[idx].borrow_qty = returnedQtyInTx - revertAmountFromThisTx;
          }
        }

        if (activeTxIndex !== -1) {
          localTxs[activeTxIndex].borrow_qty = (localTxs[activeTxIndex].borrow_qty ?? 0) + currentReturnedQty;
        }

        const eqIdx = localEq.findIndex(e => e.id === equipmentId);
        if (eqIdx !== -1) {
          const nextAvail = Math.max(0, (localEq[eqIdx].available_qty ?? 0) - currentReturnedQty);
          localEq[eqIdx].available_qty = nextAvail;
          localEq[eqIdx].status = nextAvail > 0 ? 'available' : 'borrowed';
        }

        reqItem.returned_qty = 0;
      }

      req.status = 'borrowing';
      req.updated_at = new Date().toISOString();

      localStorage.setItem('borrow_requests_local', JSON.stringify(localReqs));
      localStorage.setItem('item_inventory_transactions_data', JSON.stringify(localTxs));
      localStorage.setItem('item_inventory_equipment_data', JSON.stringify(localEq));

      return req;
    }
  } catch (e: any) {
    console.error('LocalStorage revert entire error:', e);
  }

  throw new Error('ไม่สามารถคืนสถานะรายการคืนคลังได้ เนื่องจากระบบคลังขัดข้อง');
}

// Provide Default SQL Schema setup script for the user
export const SUPABASE_SQL_SCHEMA = `-- คัดลอกสคริปต์นี้เพื่อไปรันใน SQL Editor ของ Supabase เพื่อตั้งค่าตารางแอปพลิเคชันคลังอุปกรณ์
-- 1. สร้างตารางอุปกรณ์ (equipment)
create table if not exists equipment (
  id varchar(100) primary key,
  code varchar(100) unique not null,
  name text not null,
  category varchar(100) not null,
  status varchar(50) default 'available' check (status in ('available', 'borrowed', 'maintenance', 'broken')),
  location text not null,
  description text,
  image_url text,
  total_qty integer default 1,
  available_qty integer default 1,
  maintenance_qty integer default 0,
  broken_qty integer default 0,
  created_at timestamptz default now()
);

-- การเปิดสิทธิ์ Row Level Security (RLS) - แนะนำให้ปิดชั่วคราวเพื่อพัฒนาสะดวก หรือตั้งแบบอนุญาตให้ทุกคนอ่าน-เขียนได้ก่อน
alter table equipment enable row level security;
create policy "Allow all users full access to equipment" on equipment
  for all using (true) with check (true);

-- 2. สร้างตารางบันทึกการเบิก-คืน (transactions)
create table if not exists transactions (
  id varchar(100) primary key,
  equipment_id varchar(100) references equipment(id) on delete cascade,
  equipment_code varchar(100) not null,
  equipment_name text not null,
  borrower_name text not null,
  borrower_department text not null,
  borrow_date timestamptz default now(),
  due_date timestamptz not null,
  return_date timestamptz,
  purpose text,
  status varchar(50) default 'borrowing' check (status in ('borrowing', 'returned', 'overdue')),
  condition_on_return text,
  borrow_qty integer default 1,
  evidence_image_url text,
  created_at timestamptz default now()
);

alter table transactions enable row level security;
create policy "Allow all users full access to transactions" on transactions
  for all using (true) with check (true);

-- 3. สร้างตารางบันทึกการตั้งค่าระบบ (system_settings)
create table if not exists system_settings (
  id varchar(100) primary key,
  title text not null,
  description text,
  version varchar(50),
  custom_logo text,
  custom_pin text,
  telegram_bot_token text,
  telegram_chat_id text,
  updated_at timestamptz default now()
);

alter table system_settings enable row level security;
create policy "Allow all users full access to system_settings" on system_settings
  for all using (true) with check (true);

-- 4. สร้างตารางคำขอเบิกพัสดุ (borrow_requests) — ระบบ Approval Workflow
create table if not exists borrow_requests (
  id text primary key,
  requester_name text not null,
  requester_company text not null,
  requester_contact text,
  items jsonb not null default '[]',
  purpose text not null,
  requested_due_date date not null,
  evidence_image_url text,
  status text not null default 'pending_approval'
    check (status in ('pending_approval','approved','rejected','borrowing','returned','cancelled')),
  admin_note text,
  reviewed_by text,
  reviewed_at timestamptz,
  transaction_ids jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table borrow_requests enable row level security;
create policy "Allow all users full access to borrow_requests" on borrow_requests
  for all using (true) with check (true);

-- 5. รีเซ็ตและอัปเดตแคชโครงสร้างตารางของ API ในระบบ (PostgREST Schema Cache) สำคัญมาก!
NOTIFY pgrst, 'reload schema';
`;

export const SUPABASE_MIGRATION_SQL = `-- สคริปต์แก้ไข/อัปเกรดตารางพัสดุเดิมของคุณเพื่อรองรับยอดควบคุมจำนวนพัสดุ (Multi-quantity) และการแชร์ข้อมูลหน้าเว็บบนระบบคลาวด์
-- คัดลอกและไปรันใน SQL Editor ของ Supabase เพื่อขจัดข้อผิดพลาด 'available_qty column not found' หรือเพิ่มตารางตั้งค่าโปรไฟล์แชร์ร่วมกันได้ทันที

-- 1. เพิ่มคอลัมน์ที่จำเป็นในตารางอุปกรณ์ (equipment)
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS total_qty integer default 1;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS available_qty integer default 1;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS maintenance_qty integer default 0;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS broken_qty integer default 0;

-- 2. เพิ่มคอลัมน์ที่จำเป็นในตารางรายการเบิกยืม (transactions)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS borrow_qty integer default 1;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS evidence_image_url text;

-- 3. สร้างตารางบันทึกการตั้งค่าระบบ (system_settings)
create table if not exists system_settings (
  id varchar(100) primary key,
  title text not null,
  description text,
  version varchar(50),
  custom_logo text,
  custom_pin text,
  telegram_bot_token text,
  telegram_chat_id text,
  updated_at timestamptz default now()
);

-- เพิ่มคอลัมน์การแจ้งเตือน Telegram ในตารางการตั้งค่าระบบที่มีอยู่แล้ว
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS telegram_bot_token text;
ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS telegram_chat_id text;

-- การเปิดสิทธิ์ RLS สำหรับตารางตั้งค่าระบบ
alter table system_settings enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'Allow all users full access to system_settings'
  ) then
    create policy "Allow all users full access to system_settings" on system_settings
      for all using (true) with check (true);
  end if;
end
$$;

-- 4. อัปเดตข้อมูลแถวข้อมูลเดิมที่มีอยู่ ให้มีค่าตั้งต้นเป็น 1 ชิ้น เพื่อหลีกเลี่ยงเป็นค่า NULL
UPDATE equipment SET 
  total_qty = COALESCE(total_qty, 1),
  available_qty = COALESCE(available_qty, CASE WHEN status = 'borrowed' THEN 0 ELSE 1 END),
  maintenance_qty = COALESCE(maintenance_qty, CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END),
  broken_qty = COALESCE(broken_qty, CASE WHEN status = 'broken' THEN 1 ELSE 0 END);

UPDATE transactions SET 
  borrow_qty = COALESCE(borrow_qty, 1);

-- 5. สร้างตารางคำขอเบิกพัสดุ ถ้ายังไม่มี (borrow_requests)
create table if not exists borrow_requests (
  id text primary key,
  requester_name text not null,
  requester_company text not null,
  requester_contact text,
  items jsonb not null default '[]',
  purpose text not null,
  requested_due_date date not null,
  evidence_image_url text,
  status text not null default 'pending_approval'
    check (status in ('pending_approval','approved','rejected','borrowing','returned','cancelled')),
  admin_note text,
  reviewed_by text,
  reviewed_at timestamptz,
  transaction_ids jsonb default '[]',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

do $$
begin
  if not exists (
    select 1 from pg_policies where policyname = 'Allow all users full access to borrow_requests'
  ) then
    alter table borrow_requests enable row level security;
    create policy "Allow all users full access to borrow_requests" on borrow_requests
      for all using (true) with check (true);
  end if;
end
$$;

-- 6. แจ้งเตือนระบบควบคุม API (PostgREST) ให้กวาดล้างและรีสตาร์ตโครงสร้างใหม่ทันที (แก้ปัญหา Cache Stale / PGRST204)
NOTIFY pgrst, 'reload schema';
`;
