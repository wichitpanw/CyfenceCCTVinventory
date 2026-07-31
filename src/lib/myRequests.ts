/**
 * รหัสอ้างอิงคำขอที่ผู้ใช้เครื่องนี้เคยยื่น — เก็บไว้ให้ผู้ขอตามสถานะของตัวเองได้
 * โดยไม่ต้องจดรหัสเอง และไม่ต้องมีระบบ login
 */
const KEY = 'cyfence_my_request_ids';
const PROFILE_KEY = 'cyfence_requester_profile';
const LIMIT = 50;

export interface RequesterProfile {
  name: string;
  company: string;
  customCompany: string;
  contact: string;
}

export function getMyRequestIds(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw.filter(x => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function rememberRequestId(id: string): void {
  const next = [id, ...getMyRequestIds().filter(x => x !== id)].slice(0, LIMIT);
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function getRequesterProfile(): RequesterProfile | null {
  try {
    const raw = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
    return raw && typeof raw === 'object' ? raw : null;
  } catch {
    return null;
  }
}

export function saveRequesterProfile(profile: RequesterProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}
