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
  condition_on_return?: string; // สภาพตอนคืน
  borrow_qty?: number; // จำนวนที่ยืมไป
  evidence_image_url?: string; // รูปหลักฐานถ่ายเก็บไว้ตอนทำความร่วมมือเบิก-คืน
  created_at: string;
}

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
