/**
 * Database client service for Cyfence CCTV Inventory
 * Proxies all database operations to the Cloudflare Worker API.
 */

import {
  Equipment,
  Transaction,
  SupabaseConfig,
  DashboardStats,
  SystemSettings,
  PublicSystemSettings,
  BorrowRequest,
  BorrowRequestItem,
  ReturnItemInput
} from '../types';

// Helper to make API calls to the Worker backend
async function callApi(action: string, params: any = {}): Promise<any> {
  try {
    const response = await fetch('/api/action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action, params })
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = 'API request failed';
      try {
        const errorJson = JSON.parse(errorText);
        errorMsg = errorJson.message || errorJson.error || errorMsg;
      } catch (e) {
        errorMsg = errorText || errorMsg;
      }
      throw new Error(errorMsg);
    }

    return await response.json();
  } catch (err: any) {
    console.error(`API Call error [${action}]:`, err);
    throw err;
  }
}

// Get Database Configuration (Legacy Support)
export function getDbConfig(): SupabaseConfig {
  return {
    supabaseUrl: 'cloudflare-d1',
    supabaseKey: 'connected',
    useLocalStorage: false
  };
}

// Save Database Configuration (Legacy Support)
export function saveDbConfig(config: SupabaseConfig): void {
  // No-op - connection managed by Cloudflare Workers D1 bindings
}

// Initialize Supabase Client (Legacy Support)
export function getSupabaseClient(config: SupabaseConfig): any {
  return null;
}

// Test Connection
export async function testDbConnection(config: SupabaseConfig): Promise<{ success: boolean; message: string }> {
  return callApi('testDbConnection');
}

// Equipments Fetch
export async function getEquipments(config: SupabaseConfig): Promise<Equipment[]> {
  return callApi('getEquipments');
}

// Transactions Fetch
export async function getTransactions(config: SupabaseConfig): Promise<Transaction[]> {
  return callApi('getTransactions');
}

// Add Equipment
export async function addEquipment(
  config: SupabaseConfig, 
  item: Omit<Equipment, 'id' | 'created_at'>
): Promise<Equipment> {
  return callApi('addEquipment', { item });
}

// Update Equipment
export async function updateEquipment(config: SupabaseConfig, item: Equipment): Promise<Equipment> {
  return callApi('updateEquipment', { item });
}

// Delete Equipment
export async function deleteEquipment(config: SupabaseConfig, id: string): Promise<boolean> {
  return callApi('deleteEquipment', { id });
}

// Borrow Equipment
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
  return callApi('borrowEquipment', { equipment, params });
}

// Return Equipment
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
  return callApi('returnEquipment', { transactionId, params });
}

// Get Dashboard Stats
export async function getDashboardStats(config: SupabaseConfig): Promise<DashboardStats> {
  return callApi('getDashboardStats');
}

// Get System Settings (public — ไม่มี PIN / telegram token อยู่ใน response แล้ว)
export async function getSystemSettings(config: SupabaseConfig): Promise<PublicSystemSettings | null> {
  return callApi('getSystemSettings');
}

// Save System Settings
export async function saveSystemSettings(config: SupabaseConfig, settings: Omit<SystemSettings, 'id'>): Promise<void> {
  return callApi('saveSystemSettings', { settings });
}

// ตรวจ PIN ผู้ดูแลระบบฝั่ง server
export async function verifyAdminPin(config: SupabaseConfig, pin: string): Promise<boolean> {
  const res = await callApi('verifyAdminPin', { pin });
  return res?.success === true;
}

// ทดสอบส่งข้อความ Telegram โดยใช้ token ที่เก็บไว้ใน D1 (client ไม่ต้องรู้ token)
export async function sendTelegramTest(config: SupabaseConfig, message?: string): Promise<{ success: boolean; message: string }> {
  return callApi('sendTelegramTest', { message });
}

// Get Borrow Requests
export async function getBorrowRequests(config: SupabaseConfig): Promise<BorrowRequest[]> {
  return callApi('getBorrowRequests');
}

// Create Borrow Request
export async function createBorrowRequest(config: SupabaseConfig, req: Omit<BorrowRequest, 'id' | 'status' | 'created_at' | 'updated_at' | 'transaction_ids'>): Promise<BorrowRequest> {
  return callApi('createBorrowRequest', { req });
}

// Update Borrow Request Status (Approve/Reject)
export async function updateBorrowRequestStatus(
  config: SupabaseConfig,
  requestId: string,
  newStatus: 'approved' | 'rejected' | 'cancelled' | 'borrowing',
  options: { adminNote?: string; reviewedBy?: string } = {}
): Promise<{ success: boolean; status: string; transaction_ids?: string[] }> {
  return callApi('updateBorrowRequestStatus', {
    requestId,
    newStatus,
    adminNote: options.adminNote || null,
    reviewedBy: options.reviewedBy || null,
  });
}

// Update Borrow Request Items
export async function updateBorrowRequestItems(config: SupabaseConfig, requestId: string, items: BorrowRequestItem[]): Promise<boolean> {
  return callApi('updateBorrowRequestItems', { requestId, items });
}

// Delete Borrow Request
export async function deleteBorrowRequest(config: SupabaseConfig, id: string): Promise<boolean> {
  return callApi('deleteBorrowRequest', { id });
}

// Delete Transactions Group
export async function deleteTransactionsGroup(config: SupabaseConfig, txIds: string[]): Promise<boolean> {
  return callApi('deleteTransactionsGroup', { txIds });
}

// จ่ายพัสดุออกจากคลังตามใบเบิกที่อนุมัติแล้ว — server ทำทั้งใบในครั้งเดียว
// (สร้าง transaction ทุกรายการ + ตัดสต็อก + บันทึก transaction_ids กลับเข้าใบเบิก)
export async function dispatchBorrowRequest(
  config: SupabaseConfig,
  requestId: string,
  evidenceImageUrl: string,
  dispatchedBy?: string
): Promise<{ success: boolean; transaction_ids: string[] }> {
  return callApi('dispatchBorrowRequest', { requestId, evidenceImageUrl, dispatchedBy });
}

// บันทึกรับคืนพัสดุตามใบเบิก — สภาพและหมายเหตุแยกรายชิ้น
export async function returnBorrowRequestItems(
  config: SupabaseConfig,
  requestId: string,
  returnItems: ReturnItemInput[],
  returnerName?: string,
  returnDate?: string
): Promise<{ success: boolean }> {
  return callApi('returnBorrowRequestItems', { requestId, returnItems, returnerName, returnDate });
}

// Revert Return for Borrow Request
export async function revertEntireBorrowRequestReturn(
  config: SupabaseConfig,
  requestId: string
): Promise<{ success: boolean }> {
  return callApi('revertEntireBorrowRequestReturn', { requestId });
}
