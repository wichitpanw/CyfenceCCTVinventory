-- Migration 0001: แยก "สภาพพัสดุตอนคืน" ออกจาก "หมายเหตุ" และผูก split transaction กับตัวแม่
--
-- ที่มา: revertEntireBorrowRequestReturn เดาสภาพพัสดุจาก condition_on_return ซึ่งเป็นข้อความอิสระ
-- (ค่า default = 'ปกติ เรียบร้อยดี') ทำให้ไม่เคย match 'available' และหักสต็อกผิดช่องทุกครั้ง
--
-- รันด้วย:
--   npx wrangler d1 execute cyfence-db --local  --file=migrations/0001_transaction_condition.sql
--   npx wrangler d1 execute cyfence-db --remote --file=migrations/0001_transaction_condition.sql
--
-- ALTER TABLE ... ADD COLUMN บน SQLite ปลอดภัยกับข้อมูลเดิม (แถวเก่าได้ค่า NULL)

ALTER TABLE transactions ADD COLUMN condition_status TEXT;
ALTER TABLE transactions ADD COLUMN parent_tx_id TEXT;

-- ข้อมูลเดิมแยกสภาพจริงไม่ได้แล้ว จึง backfill เป็น 'available'
-- ซึ่งเป็นค่าที่ใช้จริงเกือบทั้งหมด (โค้ดใหม่ fallback เป็น 'available' อยู่แล้วเมื่อเจอ NULL)
UPDATE transactions
   SET condition_status = 'available'
 WHERE status = 'returned'
   AND condition_status IS NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_parent_tx_id ON transactions (parent_tx_id);
CREATE INDEX IF NOT EXISTS idx_transactions_equipment_id ON transactions (equipment_id);
