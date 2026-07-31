/**
 * ย่อรูปแล้วแปลงเป็น data URL (JPEG) — ตัวกลางตัวเดียวของทั้งระบบ
 * เดิมฟังก์ชันนี้ถูกคัดลอกไว้ 3 ไฟล์ด้วยขนาดที่ไม่ตรงกัน (500px บ้าง 800px บ้าง)
 */
export async function compressImage(
  file: File,
  options: { maxSize?: number; quality?: number } = {}
): Promise<string> {
  const maxSize = options.maxSize ?? 800;
  const quality = options.quality ?? 0.75;

  if (!file.type.startsWith('image/')) {
    throw new Error('กรุณาเลือกไฟล์รูปภาพเท่านั้น (PNG, JPG, WebP)');
  }

  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(dataUrl);

  let { width, height } = img;
  const scale = Math.min(1, maxSize / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl; // เบราว์เซอร์ไม่รองรับ canvas — ใช้ไฟล์ต้นฉบับไปเลย

  // เติมพื้นขาวก่อน กัน PNG โปร่งใสกลายเป็นพื้นดำตอนแปลงเป็น JPEG
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  return canvas.toDataURL('image/jpeg', quality);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('อ่านไฟล์รูปภาพไม่สำเร็จ'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('ไฟล์รูปภาพนี้เสียหายหรือไม่รองรับ'));
    img.src = src;
  });
}
