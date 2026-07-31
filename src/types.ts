/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Equipment {
  id: string; // uuid or local string id
  code: string; // รหัสอุปกรณ์ เช่น EQ-2026-001
  name: string; // ชื่ออุปกรณ์
  category: string; // หมวดหมู่ เช่น อุปกรณ์ไอที, เครื่องมือช่าง, อุปกรณ์สำนักงาน, ถ่ายภาพ/วีดีโอ
  status: 'available' | 'borrowed' | 'maintenance' | 'broken'; // สถานะ
  location: string; // สถานที่เก็บรักษา
  description: string; // รายละเอียดเพิ่มเติม
  image_url: string; // URL รูปภาพ
  total_qty?: number; // จำนวนทั้งหมดในคลัง
  available_qty?: number; // จำนวนที่ว่างเว้นพร้อมให้เบิกจริง
  maintenance_qty?: number; // จำนวนที่ส่งซ่อมบำรุง
  broken_qty?: number; // จำนวนที่ชำรุดเสียหาย
  created_at: string;
}

export interface Transaction {
  id: string;
  equipment_id: string;
  equipment_code: string;
  equipment_name: string;
  borrower_name: string;
  borrower_department: string;
  borrow_date: string; // ISO date string
  due_date: string; // ISO date string
  return_date: string | null; // ISO date string of actual return
  purpose: string; // วัตถุประสงค์
  status: 'borrowing' | 'returned' | 'overdue'; // สถานะรายการ
  condition_on_return?: string; // หมายเหตุสภาพตอนคืน (ข้อความอิสระ)
  condition_status?: EquipmentCondition; // สภาพตอนคืนแบบมีโครงสร้าง — ใช้คำนวณ/ย้อนสต็อก
  borrow_qty?: number; // จำนวนที่ยืมไป
  evidence_image_url?: string; // รูปหลักฐานถ่ายเก็บไว้ตอนทำความร่วมมือเบิก-คืน
  parent_tx_id?: string | null; // ถ้าเกิดจากการคืนบางส่วน จะชี้ไปยัง transaction ตัวแม่
  created_at: string;
}

/** ช่องที่พัสดุจะถูกนับกลับเข้าคลังเมื่อคืน */
export type EquipmentCondition = 'available' | 'maintenance' | 'broken';

export interface SupabaseConfig {
  supabaseUrl: string;
  supabaseKey: string;
  useLocalStorage: boolean;
}

export interface DashboardStats {
  totalItems: number;
  availableItems: number;
  borrowedItems: number;
  maintenanceItems: number;
  brokenItems: number;
  totalTransactions: number;
  activeBorrows: number;
  overdueBorrows: number;
}

/** สิ่งที่ API ส่งกลับให้หน้าเว็บ — ไม่มีความลับ (PIN / bot token) อยู่ในนี้ */
export interface PublicSystemSettings {
  id: string;
  title: string;
  description: string;
  version: string;
  custom_logo: string;
  has_custom_pin: boolean;
  has_telegram_token: boolean;
  has_telegram_chat_id: boolean;
}

/** รายการที่ส่งไปตอนบันทึกรับคืน — แยกสภาพ (ช่องในคลัง) ออกจากหมายเหตุ (ข้อความ) */
export interface ReturnItemInput {
  equipment_id: string;
  qty: number;
  conditionStatus: EquipmentCondition;
  conditionNote?: string;
}

/** รูปแบบที่ใช้ตอน "บันทึก" ค่าตั้งค่าเท่านั้น — เว้นฟิลด์ความลับไว้ = คงค่าเดิม */
export interface SystemSettings {
  id: string;
  title: string;
  description: string;
  version: string;
  custom_logo: string;
  custom_pin?: string;
  telegram_bot_token?: string;
  telegram_chat_id?: string;
}

// --- Approval Workflow Types ---

export interface BorrowRequestItem {
  equipment_id: string;
  equipment_code: string;
  equipment_name: string;
  qty: number;
  returned_qty?: number;
}

export interface BorrowRequest {
  id: string;
  requester_name: string;
  requester_company: string;
  requester_contact?: string;
  items: BorrowRequestItem[];
  purpose: string;
  requested_due_date: string; // ISO date string (yyyy-MM-dd)
  evidence_image_url?: string;
  status: 'pending_approval' | 'approved' | 'rejected' | 'borrowing' | 'returned' | 'cancelled';
  admin_note?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  transaction_ids?: string[];
  created_at: string;
  updated_at: string;
}
