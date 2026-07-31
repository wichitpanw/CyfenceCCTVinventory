/**
 * ฟังก์ชันจัดรูปแบบวันที่/ข้อความภาษาไทยที่ใช้ร่วมกันทุกหน้า
 */

const TH = 'th-TH';

export function formatDate(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(TH, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(TH, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** yyyy-MM-dd ตามเวลาท้องถิ่น (ไม่ใช่ UTC) สำหรับ <input type="date"> */
export function toDateInputValue(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function todayInputValue(): string {
  return toDateInputValue(new Date());
}

export function addDaysInputValue(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toDateInputValue(d);
}

/** จำนวนวันจนถึงกำหนด (ติดลบ = เลยกำหนดมาแล้ว) นับแบบตัดเวลาออก */
export function daysUntil(dueDate?: string | null): number | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  if (isNaN(due.getTime())) return null;
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

export function isOverdue(dueDate?: string | null): boolean {
  const d = daysUntil(dueDate);
  return d !== null && d < 0;
}

/** ข้อความบอกกำหนดคืนแบบอ่านง่าย เช่น "เลยกำหนด 3 วัน" / "ครบกำหนดวันนี้" */
export function dueLabel(dueDate?: string | null): string {
  const d = daysUntil(dueDate);
  if (d === null) return '—';
  if (d < 0) return `เลยกำหนด ${Math.abs(d)} วัน`;
  if (d === 0) return 'ครบกำหนดวันนี้';
  if (d === 1) return 'ครบกำหนดพรุ่งนี้';
  return `เหลืออีก ${d} วัน`;
}
