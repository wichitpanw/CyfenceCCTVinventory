/**
 * Cloudflare Worker API for Cyfence CCTV Inventory
 * Connects to Cloudflare D1 (SQLite) and serves frontend assets.
 */

interface Env {
  DB: D1Database;
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);

    // Route Telegram Webhook
    if (url.pathname === '/api/telegram-webhook') {
      return handleTelegramWebhook(request, env);
    }

    // Route Actions (unified database API)
    if (url.pathname === '/api/action') {
      return handleActionRequest(request, env);
    }

    // Default to serving static assets
    return env.ASSETS.fetch(request);
  }
};

/**
 * Handle incoming API database action requests
 */
async function handleActionRequest(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json() as { action: string; params?: any };
    const { action, params = {} } = body;

    let result: any = null;

    switch (action) {
      case 'getEquipments':
        result = await getEquipments(env.DB);
        break;
      case 'getTransactions':
        result = await getTransactions(env.DB);
        break;
      case 'addEquipment':
        result = await addEquipment(env.DB, params.item);
        break;
      case 'updateEquipment':
        result = await updateEquipment(env.DB, params.item);
        break;
      case 'deleteEquipment':
        result = await deleteEquipment(env.DB, params.id);
        break;
      case 'borrowEquipment':
        result = await borrowEquipment(env.DB, params.equipment, params.params);
        break;
      case 'returnEquipment':
        result = await returnEquipment(env.DB, params.transactionId, params.params);
        break;
      case 'getDashboardStats':
        result = await getDashboardStats(env.DB);
        break;
      case 'getSystemSettings':
        result = await getSystemSettings(env.DB);
        break;
      case 'saveSystemSettings':
        result = await saveSystemSettings(env.DB, params.settings);
        break;
      case 'getBorrowRequests':
        result = await getBorrowRequests(env.DB);
        break;
      case 'createBorrowRequest':
        result = await createBorrowRequest(env.DB, params.req);
        break;
      case 'updateBorrowRequestStatus':
        result = await updateBorrowRequestStatus(env.DB, params.requestId, params.newStatus, params.adminNote, params.reviewedBy, params.txIds || params.transactionIds);
        break;
      case 'dispatchBorrowRequest':
        result = await dispatchBorrowRequest(env.DB, params.requestId, params.evidenceImageUrl, params.dispatchedBy);
        break;
      case 'updateBorrowRequestItems':
        result = await updateBorrowRequestItems(env.DB, params.requestId, params.items);
        break;
      case 'deleteBorrowRequest':
        result = await deleteBorrowRequest(env.DB, params.id);
        break;
      case 'deleteTransactionsGroup':
        result = await deleteTransactionsGroup(env.DB, params.txIds);
        break;
      case 'returnBorrowRequestItems':
        result = await returnBorrowRequestItems(env.DB, params.requestId, params.returnItems, params.returnerName, params.returnDate);
        break;
      case 'revertEntireBorrowRequestReturn':
        result = await revertEntireBorrowRequestReturn(env.DB, params.requestId);
        break;
      case 'testDbConnection':
        result = await testDbConnection(env.DB);
        break;
      case 'verifyAdminPin':
        result = await verifyAdminPin(env.DB, params.pin);
        break;
      case 'sendTelegramTest':
        result = await sendTelegramTest(env.DB, params.message);
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error: any) {
    console.error('API Action Error:', error);
    return new Response(JSON.stringify({ error: true, message: error.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/* ==========================================================================
   DATABASE HANDLERS
   ========================================================================== */

/** ช่องที่พัสดุถูกนับอยู่ในคลัง */
type Condition = 'available' | 'maintenance' | 'broken';

function normalizeCondition(value: any): Condition {
  return value === 'maintenance' || value === 'broken' ? value : 'available';
}

/**
 * คำสั่งขยับสต็อกแบบ relative (อ่าน-แก้-เขียนใน SQL คำสั่งเดียว) เพื่อไม่ให้สองคำขอที่เข้ามาพร้อมกัน
 * เขียนทับกัน และคำนวณ status ใหม่จากยอดหลังขยับด้วยกติกาเดียวกันทุกจุด
 *
 * หมายเหตุ: ใน SQLite ทุก expression ทางขวาของ SET มองเห็นค่า "ก่อนอัปเดต" ของแถวเสมอ
 * การอ้าง available_qty ซ้ำใน CASE จึงให้ผลตรงกับค่าที่กำลังจะเขียน
 */
function stockDelta(
  db: D1Database,
  equipmentId: string,
  delta: { available?: number; maintenance?: number; broken?: number }
): D1PreparedStatement {
  const a = delta.available ?? 0;
  const m = delta.maintenance ?? 0;
  const b = delta.broken ?? 0;
  return db.prepare(`
    UPDATE equipment SET
      available_qty   = MAX(0, COALESCE(available_qty, 0)   + ?),
      maintenance_qty = MAX(0, COALESCE(maintenance_qty, 0) + ?),
      broken_qty      = MAX(0, COALESCE(broken_qty, 0)      + ?),
      status = CASE
        WHEN MAX(0, COALESCE(available_qty, 0)   + ?) > 0 THEN 'available'
        WHEN MAX(0, COALESCE(maintenance_qty, 0) + ?) > 0 THEN 'maintenance'
        WHEN MAX(0, COALESCE(broken_qty, 0)      + ?) > 0 THEN 'broken'
        ELSE 'borrowed'
      END
    WHERE id = ?
  `).bind(a, m, b, a, m, b, equipmentId);
}

/** คำสั่งคืนพัสดุเข้าช่องตามสภาพที่ระบุ */
function stockReturn(db: D1Database, equipmentId: string, qty: number, condition: Condition): D1PreparedStatement {
  return stockDelta(db, equipmentId, { [condition]: qty } as any);
}

/** คำสั่งย้อนการคืน (หักออกจากช่องที่เคยคืนเข้าไป) */
function stockUnreturn(db: D1Database, equipmentId: string, qty: number, condition: Condition): D1PreparedStatement {
  return stockDelta(db, equipmentId, { [condition]: -qty } as any);
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
}

async function testDbConnection(db: D1Database): Promise<{ success: boolean; message: string }> {
  try {
    await db.prepare("SELECT 1").first();
    return { success: true, message: 'D1 connection successful' };
  } catch (err: any) {
    return { success: false, message: err.message || 'D1 connection failed' };
  }
}

async function getEquipments(db: D1Database): Promise<any[]> {
  const { results } = await db.prepare("SELECT * FROM equipment ORDER BY code ASC").all();
  return results.map((item: any) => ({
    ...item,
    total_qty: item.total_qty ?? 1,
    available_qty: item.available_qty ?? (item.status === 'borrowed' ? 0 : 1),
    maintenance_qty: item.maintenance_qty ?? (item.status === 'maintenance' ? 1 : 0),
    broken_qty: item.broken_qty ?? (item.status === 'broken' ? 1 : 0),
  }));
}

async function getTransactions(db: D1Database): Promise<any[]> {
  const { results } = await db.prepare("SELECT * FROM transactions ORDER BY created_at DESC").all();
  const now = new Date();
  return results.map((tx: any) => {
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
}

async function addEquipment(db: D1Database, item: any): Promise<any> {
  const id = item.id || `eq-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const nowStr = new Date().toISOString();
  await db.prepare(`
    INSERT INTO equipment (id, code, name, category, status, location, description, image_url, total_qty, available_qty, maintenance_qty, broken_qty, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    item.code,
    item.name,
    item.category,
    item.status || 'available',
    item.location || '',
    item.description || '',
    item.image_url || '',
    item.total_qty ?? 1,
    item.available_qty ?? 1,
    item.maintenance_qty ?? 0,
    item.broken_qty ?? 0,
    nowStr
  ).run();

  return { id, ...item, created_at: nowStr };
}

async function updateEquipment(db: D1Database, item: any): Promise<any> {
  // ตรวจ invariant ก่อนเขียน ไม่งั้นจะไปชน CHECK(available_qty >= 0) ของ D1 แล้วโยน error ดิบออกหน้าเว็บ
  const total = item.total_qty ?? 1;
  const available = item.available_qty ?? 1;
  const maintenance = item.maintenance_qty ?? 0;
  const broken = item.broken_qty ?? 0;

  if ([total, available, maintenance, broken].some(n => typeof n !== 'number' || !isFinite(n) || n < 0)) {
    throw new Error('จำนวนพัสดุต้องเป็นตัวเลขจำนวนเต็มที่ไม่ติดลบ');
  }
  if (available + maintenance + broken > total) {
    throw new Error(
      `จำนวนรวมไม่สอดคล้องกัน: ว่างพร้อมใช้ ${available} + ส่งซ่อม ${maintenance} + ชำรุด ${broken} ` +
      `= ${available + maintenance + broken} ชิ้น ซึ่งเกินยอดทั้งหมด ${total} ชิ้น`
    );
  }

  await db.prepare(`
    UPDATE equipment 
    SET code = ?, name = ?, category = ?, status = ?, location = ?, description = ?, image_url = ?, total_qty = ?, available_qty = ?, maintenance_qty = ?, broken_qty = ?
    WHERE id = ?
  `).bind(
    item.code,
    item.name,
    item.category,
    item.status,
    item.location || '',
    item.description || '',
    item.image_url || '',
    item.total_qty ?? 1,
    item.available_qty ?? 1,
    item.maintenance_qty ?? 0,
    item.broken_qty ?? 0,
    item.id
  ).run();

  return item;
}

async function deleteEquipment(db: D1Database, id: string): Promise<boolean> {
  await db.prepare("DELETE FROM equipment WHERE id = ?").bind(id).run();
  return true;
}

async function borrowEquipment(db: D1Database, equipment: any, params: any): Promise<any> {
  const nowStr = new Date().toISOString();
  const bDate = params.borrowDate ? new Date(params.borrowDate).toISOString() : nowStr;
  const borrowQty = params.borrowQty || 1;
  const txId = newId('tx');

  const currentEq = await db.prepare("SELECT * FROM equipment WHERE id = ?").bind(equipment.id).first() as any;
  if (!currentEq) {
    throw new Error('ไม่พบข้อมูลอุปกรณ์นี้บนระบบเซิร์ฟเวอร์');
  }

  const availableQty = currentEq.available_qty ?? (currentEq.status === 'borrowed' ? 0 : 1);
  if (availableQty < borrowQty) {
    throw new Error(`อุปกรณ์คงคลังไม่เพียงพอ (คงเหลืออยู่ ${availableQty} ชิ้น แต่ยื่นขอเบิก ${borrowQty} ชิ้น)`);
  }

  const newTx = {
    id: txId,
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
    evidence_image_url: params.evidenceImageUrl || null,
    created_at: nowStr
  };

  await db.batch([
    db.prepare(`
      INSERT INTO transactions (id, equipment_id, equipment_code, equipment_name, borrower_name, borrower_department, borrow_date, due_date, return_date, purpose, status, borrow_qty, evidence_image_url, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      newTx.id, newTx.equipment_id, newTx.equipment_code, newTx.equipment_name, newTx.borrower_name, newTx.borrower_department,
      newTx.borrow_date, newTx.due_date, newTx.return_date, newTx.purpose, newTx.status, newTx.borrow_qty, newTx.evidence_image_url, newTx.created_at
    ),
    stockDelta(db, equipment.id, { available: -borrowQty })
  ]);

  return newTx;
}

async function returnEquipment(db: D1Database, transactionId: string, params: any): Promise<any> {
  const returnDateStr = params.returnDate ? new Date(params.returnDate).toISOString() : new Date().toISOString();

  const tx = await db.prepare("SELECT * FROM transactions WHERE id = ?").bind(transactionId).first() as any;
  if (!tx) {
    throw new Error('ไม่พบประวัติรายการยืมนี้ในฐานข้อมูล');
  }
  if (tx.status === 'returned') {
    throw new Error('รายการเบิกยืมนี้ระบุว่าได้ทำรายการคืนคลังเรียบร้อยแล้วก่อนหน้า');
  }

  const bQty = tx.borrow_qty ?? 1;
  const rQty = params.returnQty ?? bQty;
  if (rQty > bQty) {
    throw new Error(`ไม่สามารถคืนอุปกรณ์จำนวน ${rQty} ชิ้นได้ เนื่องจากมียอดค้างยืมเพียง ${bQty} ชิ้น`);
  }

  const currentEq = await db.prepare("SELECT id FROM equipment WHERE id = ?").bind(tx.equipment_id).first() as any;
  if (!currentEq) {
    throw new Error('ไม่พบข้อมูลตัวอุปกรณ์ในคลังระบบ');
  }

  const condition = normalizeCondition(params.itemConditionStatus);

  let finalReturnedTx: any;
  const stmts: D1PreparedStatement[] = [];

  if (rQty < bQty) {
    // Partial return: split transaction
    const remainingQty = bQty - rQty;
    stmts.push(
      db.prepare("UPDATE transactions SET borrow_qty = ? WHERE id = ?").bind(remainingQty, transactionId)
    );

    finalReturnedTx = {
      ...tx,
      id: newId('tx'),
      borrow_qty: rQty,
      status: 'returned',
      return_date: returnDateStr,
      condition_on_return: params.conditionOnReturn,
      condition_status: condition,
      parent_tx_id: transactionId,
      created_at: new Date().toISOString()
    };

    stmts.push(
      db.prepare(`
        INSERT INTO transactions (id, equipment_id, equipment_code, equipment_name, borrower_name, borrower_department, borrow_date, due_date, return_date, purpose, status, condition_on_return, condition_status, parent_tx_id, borrow_qty, evidence_image_url, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        finalReturnedTx.id, finalReturnedTx.equipment_id, finalReturnedTx.equipment_code, finalReturnedTx.equipment_name,
        finalReturnedTx.borrower_name, finalReturnedTx.borrower_department, finalReturnedTx.borrow_date, finalReturnedTx.due_date,
        finalReturnedTx.return_date, finalReturnedTx.purpose, finalReturnedTx.status, finalReturnedTx.condition_on_return,
        finalReturnedTx.condition_status, finalReturnedTx.parent_tx_id,
        finalReturnedTx.borrow_qty, finalReturnedTx.evidence_image_url || null, finalReturnedTx.created_at
      )
    );
  } else {
    // Full return
    stmts.push(
      db.prepare("UPDATE transactions SET return_date = ?, condition_on_return = ?, condition_status = ?, status = 'returned' WHERE id = ?")
        .bind(returnDateStr, params.conditionOnReturn, condition, transactionId)
    );
    finalReturnedTx = {
      ...tx,
      return_date: returnDateStr,
      condition_on_return: params.conditionOnReturn,
      condition_status: condition,
      status: 'returned'
    };
  }

  // คืนพัสดุเข้าช่องตามสภาพ (relative — กันสองรายการที่คืนพร้อมกันเขียนทับกัน)
  stmts.push(stockReturn(db, tx.equipment_id, rQty, condition));

  await db.batch(stmts);

  // Sync with borrow requests
  try {
    const { results: relatedReqs } = await db.prepare("SELECT * FROM borrow_requests WHERE transaction_ids LIKE ?").bind(`%${transactionId}%`).all();
    if (relatedReqs && relatedReqs.length > 0) {
      for (const req of relatedReqs as any[]) {
        const txIds = JSON.parse(req.transaction_ids || '[]');
        if (txIds.includes(transactionId)) {
          let updatedTxIds = [...txIds];
          let updatedItems = JSON.parse(req.items || '[]');

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

          // สรุปจากยอดคืนในใบเบิก (ตรงกับ returnBorrowRequestItems)
          const allReturned = updatedItems.every((it: any) => (it.returned_qty || 0) >= it.qty);

          await db.prepare("UPDATE borrow_requests SET status = ?, transaction_ids = ?, items = ?, updated_at = ? WHERE id = ?")
            .bind(allReturned ? 'returned' : 'borrowing', JSON.stringify(updatedTxIds), JSON.stringify(updatedItems), new Date().toISOString(), req.id)
            .run();
        }
      }
    }
  } catch (syncErr) {
    console.warn('Sync warning: Failed to sync return with borrow_request', syncErr);
  }

  return finalReturnedTx;
}

async function getDashboardStats(db: D1Database): Promise<any> {
  const totalItems = await db.prepare("SELECT SUM(total_qty) as total FROM equipment").first() as any;
  const availableItems = await db.prepare("SELECT SUM(available_qty) as total FROM equipment").first() as any;
  const borrowedItems = await db.prepare("SELECT SUM(total_qty - available_qty - maintenance_qty - broken_qty) as total FROM equipment").first() as any;
  const maintenanceItems = await db.prepare("SELECT SUM(maintenance_qty) as total FROM equipment").first() as any;
  const brokenItems = await db.prepare("SELECT SUM(broken_qty) as total FROM equipment").first() as any;

  const totalTransactions = await db.prepare("SELECT COUNT(*) as total FROM transactions").first() as any;
  const activeBorrows = await db.prepare("SELECT COUNT(*) as total FROM transactions WHERE status = 'borrowing'").first() as any;
  const overdueBorrows = await db.prepare("SELECT COUNT(*) as total FROM transactions WHERE status = 'borrowing' AND due_date < ?").bind(new Date().toISOString()).first() as any;

  return {
    totalItems: totalItems?.total || 0,
    availableItems: availableItems?.total || 0,
    borrowedItems: Math.max(0, borrowedItems?.total || 0),
    maintenanceItems: maintenanceItems?.total || 0,
    brokenItems: brokenItems?.total || 0,
    totalTransactions: totalTransactions?.total || 0,
    activeBorrows: activeBorrows?.total || 0,
    overdueBorrows: overdueBorrows?.total || 0
  };
}

/**
 * อ่านค่าตั้งค่าระบบแบบเต็ม (มีความลับ) — ใช้ภายใน worker เท่านั้น ห้ามส่งออก response
 */
async function getSystemSettingsRaw(db: D1Database): Promise<any> {
  let settings = await db.prepare("SELECT * FROM system_settings WHERE id = 'default'").first() as any;
  if (!settings) {
    settings = {
      id: 'default',
      title: 'ระบบบริหารคลังอุปกรณ์ (CCTV Inventory)',
      description: 'ระบบจัดการและเบิกจ่ายอุปกรณ์กล้องวงจรปิด',
      version: '1.0.0',
      custom_logo: '',
      custom_pin: '888888',
      telegram_bot_token: '',
      telegram_chat_id: '',
      updated_at: new Date().toISOString()
    };
    await db.prepare(`
      INSERT INTO system_settings (id, title, description, version, custom_logo, custom_pin, telegram_bot_token, telegram_chat_id, updated_at) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(settings.id, settings.title, settings.description, settings.version, settings.custom_logo, settings.custom_pin, settings.telegram_bot_token, settings.telegram_chat_id, settings.updated_at).run();
  }
  return settings;
}

/**
 * เวอร์ชันสาธารณะ — ตัด custom_pin / telegram_bot_token / telegram_chat_id ออกก่อนส่งกลับ
 * (เดิมส่งความลับทั้งหมดให้ทุกคนที่เปิดเว็บ เปิด DevTools ก็เห็น)
 */
async function getSystemSettings(db: D1Database): Promise<any> {
  const s = await getSystemSettingsRaw(db);
  return {
    id: s.id,
    title: s.title,
    description: s.description,
    version: s.version,
    custom_logo: s.custom_logo,
    has_custom_pin: !!s.custom_pin,
    has_telegram_token: !!s.telegram_bot_token,
    has_telegram_chat_id: !!s.telegram_chat_id,
  };
}

/** ตรวจ PIN ผู้ดูแลระบบฝั่ง server — ไม่ส่ง PIN จริงออกไปให้ client เทียบเอง */
async function verifyAdminPin(db: D1Database, pin: any): Promise<{ success: boolean }> {
  if (typeof pin !== 'string' || pin.length === 0) return { success: false };
  const s = await getSystemSettingsRaw(db);
  const target = s?.custom_pin || '888888';
  return { success: pin === target };
}

/** ส่งข้อความทดสอบโดยใช้ token ที่เก็บไว้ใน D1 — client ไม่ต้องรู้ token */
async function sendTelegramTest(db: D1Database, message?: string): Promise<{ success: boolean; message: string }> {
  const s = await getSystemSettingsRaw(db);
  if (!s?.telegram_bot_token || !s?.telegram_chat_id) {
    return { success: false, message: 'ยังไม่ได้บันทึก Bot Token และ Chat ID ในระบบ กรุณากรอกและกดบันทึกก่อนทดสอบค่ะ' };
  }
  const text = message || `<b>🔔 ทดสอบการแจ้งเตือนระบบคลังพัสดุสำเร็จ!</b>\n\nการเชื่อมโยงบอท Telegram กับ <b>${s.title}</b> ทำงานได้เรียบร้อยแล้วค่ะ`;
  const ok = await sendTelegramNotification(s.telegram_bot_token, s.telegram_chat_id, text);
  return ok
    ? { success: true, message: '✅ ส่งข้อความทดสอบไปยัง Telegram สำเร็จแล้ว! กรุณาตรวจสอบในห้องแชทของท่านค่ะ' }
    : { success: false, message: '❌ ส่งไม่สำเร็จ กรุณาตรวจสอบ Bot Token / Chat ID และต้องแอดบอทเข้าห้องแชทแล้วกด /start ก่อนนะคะ' };
}

async function saveSystemSettings(db: D1Database, settings: any): Promise<void> {
  await db.prepare(`
    INSERT INTO system_settings (id, title, description, version, custom_logo, custom_pin, telegram_bot_token, telegram_chat_id, updated_at)
    VALUES ('default', ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title,
      description=excluded.description,
      version=excluded.version,
      custom_logo=excluded.custom_logo,
      custom_pin=COALESCE(excluded.custom_pin, system_settings.custom_pin),
      telegram_bot_token=COALESCE(excluded.telegram_bot_token, system_settings.telegram_bot_token),
      telegram_chat_id=COALESCE(excluded.telegram_chat_id, system_settings.telegram_chat_id),
      updated_at=excluded.updated_at
  `).bind(
    settings.title,
    settings.description,
    settings.version,
    settings.custom_logo || '',
    settings.custom_pin || null,
    settings.telegram_bot_token || null,
    settings.telegram_chat_id || null,
    new Date().toISOString()
  ).run();
}

async function getBorrowRequests(db: D1Database): Promise<any[]> {
  const { results } = await db.prepare("SELECT * FROM borrow_requests ORDER BY created_at DESC").all();
  return results.map((row: any) => ({
    ...row,
    items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
    transaction_ids: typeof row.transaction_ids === 'string' ? JSON.parse(row.transaction_ids || '[]') : row.transaction_ids
  }));
}

async function createBorrowRequest(db: D1Database, req: any): Promise<any> {
  const id = newId('req');
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO borrow_requests (id, requester_name, requester_company, requester_contact, items, purpose, requested_due_date, evidence_image_url, status, admin_note, reviewed_by, reviewed_at, transaction_ids, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    req.requester_name,
    req.requester_company,
    req.requester_contact || '',
    JSON.stringify(req.items),
    req.purpose,
    req.requested_due_date,
    req.evidence_image_url || '',
    'pending_approval',
    null,
    null,
    null,
    JSON.stringify([]),
    now,
    now
  ).run();

  // แจ้งเตือน Telegram จากฝั่ง server เพื่อไม่ต้องส่ง bot token ออกไปให้หน้าเว็บ
  // ล้มเหลวได้โดยไม่กระทบการยื่นคำขอ
  try {
    const s = await getSystemSettingsRaw(db);
    if (s?.telegram_bot_token && s?.telegram_chat_id) {
      const items = Array.isArray(req.items) ? req.items : [];
      const itemsStr = items
        .map((i: any) => `• <b>${escapeHtml(i.equipment_name)}</b> (${escapeHtml(i.equipment_code)}) — <code>${i.qty}</code> ชิ้น`)
        .join('\n');
      const message =
        `<b>🔔 มีคำขอเบิกพัสดุใหม่เข้ามาในระบบ!</b>\n\n` +
        `👤 <b>ผู้ยื่นคำขอ:</b> ${escapeHtml(req.requester_name)}\n` +
        `🏢 <b>บริษัท/สังกัด:</b> ${escapeHtml(req.requester_company)}\n` +
        `📞 <b>เบอร์โทรติดต่อ:</b> ${escapeHtml(req.requester_contact || 'ไม่ระบุ')}\n\n` +
        `📦 <b>รายการพัสดุที่ขอเบิก:</b>\n${itemsStr}\n\n` +
        `📝 <b>วัตถุประสงค์/สถานที่:</b>\n${escapeHtml(req.purpose || 'ไม่ระบุ')}\n\n` +
        `📅 <b>กำหนดคืนพัสดุ:</b> ${escapeHtml(req.requested_due_date)}\n` +
        `🏷️ <b>รหัสอ้างอิงคำขอ:</b> <code>${id}</code>`;
      await sendTelegramNotification(s.telegram_bot_token, s.telegram_chat_id, message);
    }
  } catch (notifyErr) {
    console.warn('Telegram notify failed for new borrow request:', notifyErr);
  }

  return {
    id,
    ...req,
    status: 'pending_approval',
    transaction_ids: [],
    created_at: now,
    updated_at: now
  };
}

/** กัน HTML injection ในข้อความ Telegram (parse_mode: HTML) */
function escapeHtml(value: any): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function updateBorrowRequestStatus(db: D1Database, requestId: string, newStatus: string, adminNote?: any, reviewedBy?: any, txIds?: string[]): Promise<any> {
  const req = await db.prepare("SELECT * FROM borrow_requests WHERE id = ?").bind(requestId).first() as any;
  if (!req) {
    throw new Error('ไม่พบคำขอเบิกนี้ในระบบ');
  }

  // Extract primitive string values to prevent D1_TYPE_ERROR on objects
  let safeAdminNote: string | null = null;
  let safeReviewedBy: string | null = null;

  if (typeof adminNote === 'string') {
    safeAdminNote = adminNote || null;
  } else if (adminNote && typeof adminNote === 'object') {
    safeAdminNote = adminNote.adminNote || adminNote.note || null;
    if (adminNote.reviewedBy && typeof adminNote.reviewedBy === 'string') {
      safeReviewedBy = adminNote.reviewedBy;
    }
  }

  if (typeof reviewedBy === 'string') {
    safeReviewedBy = reviewedBy || null;
  } else if (reviewedBy && typeof reviewedBy === 'object') {
    if (reviewedBy.reviewedBy && typeof reviewedBy.reviewedBy === 'string') {
      safeReviewedBy = reviewedBy.reviewedBy;
    }
  }

  const now = new Date().toISOString();

  if (newStatus === 'approved') {
    if (req.status !== 'pending_approval') {
      throw new Error('คำขอนี้ได้รับการดำเนินการไปแล้ว ไม่สามารถเปลี่ยนสถานะได้');
    }
    await db.prepare("UPDATE borrow_requests SET status = 'approved', admin_note = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?")
      .bind(safeAdminNote, safeReviewedBy, now, now, requestId)
      .run();
    return { success: true, status: 'approved' };
  } else if (newStatus === 'borrowing') {
    if (txIds && txIds.length > 0) {
      await db.prepare("UPDATE borrow_requests SET status = 'borrowing', transaction_ids = ?, updated_at = ? WHERE id = ?")
        .bind(JSON.stringify(txIds), now, requestId)
        .run();
    } else {
      await db.prepare("UPDATE borrow_requests SET status = 'borrowing', updated_at = ? WHERE id = ?")
        .bind(now, requestId)
        .run();
    }
    return { success: true, status: 'borrowing' };
  } else {
    // Rejected or Cancelled
    const finalStatus = newStatus === 'rejected' ? 'rejected' : 'cancelled';
    await db.prepare("UPDATE borrow_requests SET status = ?, admin_note = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?")
      .bind(finalStatus, safeAdminNote, safeReviewedBy, now, now, requestId)
      .run();
    return { success: true, status: finalStatus };
  }
}

/**
 * จ่ายพัสดุออกจากคลังตามใบเบิกที่อนุมัติแล้ว — ทำทั้งใบในครั้งเดียว
 *
 * เดิม client วนเรียก borrowEquipment ทีละรายการ แล้วค่อยสั่งเปลี่ยนสถานะ ทำให้
 *   1) transaction_ids ไม่เคยถูกบันทึกกลับเข้าใบเบิก (ตัวแปรที่เก็บ id ไม่ได้ถูกส่งไปไหนเลย)
 *   2) ถ้ารายการกลางทางล้มเหลว สต็อกถูกตัดไปแล้วบางส่วนแต่ใบยังเป็น approved → กดซ้ำ = ตัดซ้ำ
 * ที่นี่จึงตรวจสต็อกให้ครบก่อน แล้วเขียนทุกอย่างใน batch เดียว
 */
async function dispatchBorrowRequest(
  db: D1Database,
  requestId: string,
  evidenceImageUrl?: string,
  dispatchedBy?: string
): Promise<{ success: boolean; transaction_ids: string[] }> {
  const req = await db.prepare("SELECT * FROM borrow_requests WHERE id = ?").bind(requestId).first() as any;
  if (!req) {
    throw new Error('ไม่พบใบคำขอเบิกนี้ในระบบ');
  }
  if (req.status !== 'approved') {
    throw new Error(
      req.status === 'borrowing'
        ? 'ใบเบิกนี้จ่ายพัสดุออกจากคลังไปแล้ว ไม่สามารถจ่ายซ้ำได้'
        : 'จ่ายพัสดุได้เฉพาะใบเบิกที่อยู่ในสถานะ "อนุมัติแล้ว" เท่านั้น'
    );
  }

  const items: any[] = JSON.parse(req.items || '[]');
  if (items.length === 0) {
    throw new Error('ใบเบิกนี้ไม่มีรายการพัสดุ');
  }

  // 1) ตรวจสต็อกให้ครบทุกรายการก่อน ยังไม่เขียนอะไรทั้งสิ้น
  const shortages: string[] = [];
  const equipmentById = new Map<string, any>();
  for (const item of items) {
    const eq = await db.prepare("SELECT * FROM equipment WHERE id = ?").bind(item.equipment_id).first() as any;
    if (!eq) {
      shortages.push(`${item.equipment_name} (ไม่พบในคลังแล้ว)`);
      continue;
    }
    equipmentById.set(item.equipment_id, eq);
    const available = eq.available_qty ?? 0;
    if (available < item.qty) {
      shortages.push(`${item.equipment_name}: ขอ ${item.qty} ชิ้น แต่คงเหลือ ${available} ชิ้น`);
    }
  }
  if (shortages.length > 0) {
    throw new Error(`สต็อกไม่พอสำหรับจ่ายพัสดุ:\n${shortages.join('\n')}`);
  }

  // 2) เขียนทั้งหมดในชุดเดียว
  const now = new Date().toISOString();
  const dueDateIso = new Date(req.requested_due_date).toISOString();
  const stmts: D1PreparedStatement[] = [];
  const txIds: string[] = [];

  for (const item of items) {
    const eq = equipmentById.get(item.equipment_id);
    const txId = newId('tx');
    txIds.push(txId);

    stmts.push(
      db.prepare(`
        INSERT INTO transactions (id, equipment_id, equipment_code, equipment_name, borrower_name, borrower_department, borrow_date, due_date, return_date, purpose, status, borrow_qty, evidence_image_url, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 'borrowing', ?, ?, ?)
      `).bind(
        txId, item.equipment_id, eq.code, eq.name,
        req.requester_name, req.requester_company,
        now, dueDateIso, req.purpose, item.qty,
        evidenceImageUrl || null, now
      )
    );
    stmts.push(stockDelta(db, item.equipment_id, { available: -item.qty }));
  }

  const reviewedBy = [req.reviewed_by, dispatchedBy ? `ผู้จ่ายพัสดุ: ${dispatchedBy}` : null]
    .filter(Boolean)
    .join(' | ') || null;

  stmts.push(
    db.prepare("UPDATE borrow_requests SET status = 'borrowing', transaction_ids = ?, evidence_image_url = COALESCE(?, evidence_image_url), reviewed_by = ?, updated_at = ? WHERE id = ?")
      .bind(JSON.stringify(txIds), evidenceImageUrl || null, reviewedBy, now, requestId)
  );

  await db.batch(stmts);

  return { success: true, transaction_ids: txIds };
}

async function updateBorrowRequestItems(db: D1Database, requestId: string, items: any[]): Promise<boolean> {
  await db.prepare("UPDATE borrow_requests SET items = ?, updated_at = ? WHERE id = ?")
    .bind(JSON.stringify(items), new Date().toISOString(), requestId)
    .run();
  return true;
}

/**
 * ลบใบเบิกพร้อมย้อนผลกระทบต่อสต็อกให้ครบทุกกรณี
 * - transaction ที่ยัง borrowing → คืนยอดกลับเข้า available
 * - transaction ที่ returned แล้ว → หักออกจากช่องที่เคยถูกคืนเข้าไป (available/maintenance/broken)
 * เดิมแตะเฉพาะ available ของ tx ที่ borrowing เท่านั้น ทำให้ยอดส่งซ่อม/ชำรุดค้างถาวร
 */
async function deleteBorrowRequest(db: D1Database, id: string): Promise<boolean> {
  const req = await db.prepare("SELECT * FROM borrow_requests WHERE id = ?").bind(id).first() as any;
  if (req) {
    const txIds = JSON.parse(req.transaction_ids || '[]');
    if (Array.isArray(txIds) && txIds.length > 0) {
      const placeholders = txIds.map(() => '?').join(',');
      const { results: txs } = await db.prepare(`SELECT * FROM transactions WHERE id IN (${placeholders})`).bind(...txIds).all();

      const stmts: D1PreparedStatement[] = [];
      for (const tx of (txs || []) as any[]) {
        const qty = tx.borrow_qty ?? 1;
        if (tx.status === 'returned') {
          stmts.push(stockUnreturn(db, tx.equipment_id, qty, normalizeCondition(tx.condition_status)));
        } else {
          stmts.push(stockDelta(db, tx.equipment_id, { available: qty }));
        }
      }
      stmts.push(db.prepare(`DELETE FROM transactions WHERE id IN (${placeholders})`).bind(...txIds));
      await db.batch(stmts);
    }
  }
  await db.prepare("DELETE FROM borrow_requests WHERE id = ?").bind(id).run();
  return true;
}

async function deleteTransactionsGroup(db: D1Database, txIds: string[]): Promise<boolean> {
  if (!Array.isArray(txIds) || txIds.length === 0) return true;
  const placeholders = txIds.map(() => '?').join(',');
  await db.prepare(`DELETE FROM transactions WHERE id IN (${placeholders})`).bind(...txIds).run();
  return true;
}

async function returnBorrowRequestItems(db: D1Database, requestId: string, returnItems: any[], returnerName?: string, returnDate?: string): Promise<any> {
  const req = await db.prepare("SELECT * FROM borrow_requests WHERE id = ?").bind(requestId).first() as any;
  if (!req) {
    throw new Error('ไม่พบข้อมูลใบเบิกพัสดุ');
  }

  const items = JSON.parse(req.items || '[]');
  const txIds = JSON.parse(req.transaction_ids || '[]');
  const now = new Date().toISOString();
  const returnDateStr = returnDate ? new Date(returnDate).toISOString() : now;

  const stmts: D1PreparedStatement[] = [];
  const newTxIds = [...txIds];

  for (const returnItem of returnItems) {
    const itemIndex = items.findIndex((x: any) => x.equipment_id === returnItem.equipment_id);
    if (itemIndex === -1) continue;

    const item = items[itemIndex];
    const prevReturned = item.returned_qty || 0;
    const returningQty = returnItem.qty;

    // สภาพและหมายเหตุแยกต่อรายการ
    const itemCondition = normalizeCondition(returnItem.conditionStatus);
    const itemNote = returnItem.conditionNote || 'ปกติ เรียบร้อยดี';

    if (prevReturned + returningQty > item.qty) {
      throw new Error(`ไม่สามารถคืนอุปกรณ์ ${item.equipment_name} จำนวน ${returningQty} ชิ้นได้ เนื่องจากเกินยอดเบิก`);
    }

    item.returned_qty = prevReturned + returningQty;

    // Find active borrowing transactions for this request & equipment
    let activeTxs: any[] = [];
    if (txIds.length > 0) {
      const placeholders = txIds.map(() => '?').join(',');
      const { results } = await db.prepare(`
        SELECT * FROM transactions
        WHERE id IN (${placeholders}) AND equipment_id = ? AND status = 'borrowing'
      `).bind(...txIds, returnItem.equipment_id).all();
      activeTxs = results || [];
    }

    let remainingToReturn = returningQty;
    for (const tx of activeTxs) {
      if (remainingToReturn <= 0) break;

      const bQty = tx.borrow_qty ?? 1;
      if (remainingToReturn < bQty) {
        // Partial return of transaction: split
        const remainingQty = bQty - remainingToReturn;
        stmts.push(
          db.prepare("UPDATE transactions SET borrow_qty = ? WHERE id = ?").bind(remainingQty, tx.id)
        );

        const splitId = newId('tx');
        newTxIds.push(splitId);

        stmts.push(
          db.prepare(`
            INSERT INTO transactions (id, equipment_id, equipment_code, equipment_name, borrower_name, borrower_department, borrow_date, due_date, return_date, purpose, status, condition_on_return, condition_status, parent_tx_id, borrow_qty, evidence_image_url, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'returned', ?, ?, ?, ?, ?, ?)
          `).bind(
            splitId, tx.equipment_id, tx.equipment_code, tx.equipment_name, tx.borrower_name, tx.borrower_department,
            tx.borrow_date, tx.due_date, returnDateStr, tx.purpose, itemNote, itemCondition, tx.id,
            remainingToReturn, tx.evidence_image_url || null, now
          )
        );
        remainingToReturn = 0;
      } else {
        // Full return of transaction
        stmts.push(
          db.prepare("UPDATE transactions SET return_date = ?, condition_on_return = ?, condition_status = ?, status = 'returned' WHERE id = ?")
            .bind(returnDateStr, itemNote, itemCondition, tx.id)
        );
        remainingToReturn -= bQty;
      }
    }

    // คืนพัสดุเข้าช่องตามสภาพของรายการนี้ (relative — ไม่อ่านค่ามาคำนวณใน JS แล้วเขียนทับ)
    stmts.push(stockReturn(db, returnItem.equipment_id, returningQty, itemCondition));
  }

  await db.batch(stmts);

  // สรุปสถานะจากยอดคืนในตัวใบเบิกเอง — เชื่อถือได้แม้ใบเก่าที่ transaction_ids ว่าง
  // (ใบที่ถูกจ่ายก่อนแก้บั๊ก dispatch จะไม่มี tx ผูกไว้ ถ้าไปสรุปจาก tx จะค้าง borrowing ตลอดกาล)
  const allReturned = items.every((it: any) => (it.returned_qty || 0) >= it.qty);

  // บันทึกชื่อผู้รับคืนต่อท้ายข้อมูลผู้ดำเนินการ (ไม่เขียนซ้ำถ้าเป็นคนเดิม)
  let reviewedBy = req.reviewed_by || null;
  if (returnerName) {
    const tag = `ผู้รับคืน: ${returnerName}`;
    reviewedBy = reviewedBy && !reviewedBy.includes(tag) ? `${reviewedBy} | ${tag}` : (reviewedBy || tag);
  }

  await db.prepare("UPDATE borrow_requests SET status = ?, items = ?, transaction_ids = ?, reviewed_by = ?, updated_at = ? WHERE id = ?")
    .bind(allReturned ? 'returned' : 'borrowing', JSON.stringify(items), JSON.stringify(newTxIds), reviewedBy, now, requestId)
    .run();

  return { success: true };
}

async function revertEntireBorrowRequestReturn(db: D1Database, requestId: string): Promise<any> {
  const req = await db.prepare("SELECT * FROM borrow_requests WHERE id = ?").bind(requestId).first() as any;
  if (!req) {
    throw new Error('ไม่พบข้อมูลคำขอนี้ในระบบ');
  }

  const items = JSON.parse(req.items || '[]');
  const txIds = JSON.parse(req.transaction_ids || '[]');
  const now = new Date().toISOString();

  // Reset items returned_qty
  const resetItems = items.map((item: any) => ({ ...item, returned_qty: 0 }));

  // Find all transactions associated with this request
  let txs: any[] = [];
  if (txIds.length > 0) {
    const placeholders = txIds.map(() => '?').join(',');
    const { results } = await db.prepare(`SELECT * FROM transactions WHERE id IN (${placeholders})`).bind(...txIds).all();
    txs = results || [];
  }

  const stmts: D1PreparedStatement[] = [];
  const restoredTxIds: string[] = [];

  for (const tx of txs) {
    if (tx.status === 'returned') {
      // หักคืนออกจาก "ช่องที่เคยถูกคืนเข้าไปจริง" ตาม condition_status
      // (เดิมเดาจากข้อความ condition_on_return ซึ่ง default คือ 'ปกติ เรียบร้อยดี'
      //  จึงไม่เคย match แล้วตกไปหัก broken เสมอ → available บวมเกินจริงทุกครั้ง)
      stmts.push(stockUnreturn(db, tx.equipment_id, tx.borrow_qty ?? 1, normalizeCondition(tx.condition_status)));

      // ถ้าแถวนี้เกิดจากการคืนบางส่วน ให้รวมจำนวนกลับเข้าแถวแม่ที่ผูกไว้ตรง ๆ แล้วลบแถวนี้ทิ้ง
      const parentTx = tx.parent_tx_id
        ? txs.find((p: any) => p.id === tx.parent_tx_id)
        : undefined;
      if (parentTx) {
        stmts.push(
          db.prepare("UPDATE transactions SET borrow_qty = borrow_qty + ? WHERE id = ?").bind(tx.borrow_qty, parentTx.id)
        );
        stmts.push(
          db.prepare("DELETE FROM transactions WHERE id = ?").bind(tx.id)
        );
      } else {
        // Revert full return to borrowing
        stmts.push(
          db.prepare("UPDATE transactions SET return_date = NULL, condition_on_return = NULL, condition_status = NULL, status = 'borrowing' WHERE id = ?").bind(tx.id)
        );
        restoredTxIds.push(tx.id);
      }
    } else {
      restoredTxIds.push(tx.id);
    }
  }

  if (stmts.length > 0) {
    await db.batch(stmts);
  }

  await db.prepare("UPDATE borrow_requests SET status = 'borrowing', items = ?, transaction_ids = ?, updated_at = ? WHERE id = ?")
    .bind(JSON.stringify(resetItems), JSON.stringify(restoredTxIds), now, requestId)
    .run();

  return { success: true };
}

/* ==========================================================================
   TELEGRAM UTILITIES & WEBHOOK ROUTER
   ========================================================================== */

async function sendTelegramNotification(token: string, chatId: string, message: string): Promise<boolean> {
  const telegramApiUrl = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const response = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      })
    });
    const result = await response.json() as any;
    return result.ok === true;
  } catch (e) {
    console.error('Failed to send Telegram message:', e);
    return false;
  }
}

async function handleTelegramWebhook(request: Request, env: Env): Promise<Response> {
  const settings = await getSystemSettingsRaw(env.DB);
  if (!settings || !settings.telegram_bot_token) {
    return new Response(JSON.stringify({ error: 'Telegram Bot Token not configured in Cyfence Settings panel.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const botToken = settings.telegram_bot_token;
  const telegramApiUrl = `https://api.telegram.org/bot${botToken}`;

  const sendTelegram = async (method: string, body: any) => {
    try {
      const response = await fetch(`${telegramApiUrl}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      return await response.json();
    } catch (e) {
      console.error(`Telegram API error on ${method}:`, e);
      return { ok: false, error: e };
    }
  };

  // GET: Setup webhook registration wizard
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const host = request.headers.get('host') || url.host;
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const webhookUrl = `${protocol}://${host}/api/telegram-webhook`;

    try {
      const response = await fetch(`${telegramApiUrl}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
      const result = await response.json() as any;
      if (result.ok) {
        return new Response(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Telegram Webhook Registration</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #F5F5F7; color: #1D1D1F; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                .card { background: white; padding: 40px 30px; border-radius: 28px; box-shadow: 0 10px 30px rgba(0,0,0,0.03); text-align: center; max-width: 420px; border: 1px solid #E8E8ED; box-sizing: border-box; }
                .icon { font-size: 54px; margin-bottom: 24px; animation: pulse 2s infinite ease-in-out; }
                h1 { font-size: 20px; font-weight: 800; margin: 0 0 12px 0; color: #1D1D1F; letter-spacing: -0.5px; }
                p { font-size: 13px; color: #86868B; line-height: 1.6; margin: 0 0 24px 0; }
                .url-box { font-family: "SFMono-Regular", Consolas, monospace; background: #F5F5F7; padding: 12px 16px; border-radius: 12px; font-size: 11px; color: #1D1D1F; word-break: break-all; margin: 15px 0; border: 1px solid #E8E8ED; text-align: left; }
                .response-status { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #1E8E3E; background: #E6F4EA; padding: 6px 14px; border-radius: 50px; font-weight: bold; margin-bottom: 20px; }
                .btn { background: black; color: white; border: none; padding: 14px 28px; border-radius: 14px; font-size: 13px; font-weight: bold; cursor: pointer; text-decoration: none; display: inline-block; transition: all 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                .btn:hover { background: #1D1D1F; transform: translateY(-1px); }
                @keyframes pulse {
                  0% { transform: scale(1); }
                  50% { transform: scale(1.08); }
                  100% { transform: scale(1); }
                }
              </style>
            </head>
            <body>
              <div class="card">
                <div class="icon">🤖</div>
                <h1>ลงทะเบียน Webhook สำเร็จ!</h1>
                <p>บอทของคุณผูกระบบรับคำสั่งผ่าน Cloudflare Workers เรียบร้อยแล้วค่ะ:</p>
                <div class="url-box">${webhookUrl}</div>
                <div class="response-status">🟢 Telegram: ${result.description}</div>
                <div>
                  <a href="${protocol}://${host}" class="btn">เข้าสู่หน้าหลักคลังพัสดุ</a>
                </div>
              </div>
            </body>
          </html>
        `, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      } else {
        return new Response(`Failed to register Telegram webhook: ${JSON.stringify(result)}`, { status: 400 });
      }
    } catch (err: any) {
      return new Response(`Error setting Telegram webhook: ${err?.message || err}`, { status: 500 });
    }
  }

  // POST: Handle incoming Telegram messages
  if (request.method === 'POST') {
    try {
      const update = await request.json() as any;
      if (!update) {
        return new Response('No payload.', { status: 200 });
      }

      // A. Message replies or texts
      if (update.message) {
        const chatId = update.message.chat.id;
        const text = (update.message.text || '').trim();

        if (text === '/start' || text.toLowerCase() === '/stock' || text.includes('เช็คสต๊อก') || text.includes('สต็อก')) {
          // Fetch dynamic categories
          const { results: eqs } = await env.DB.prepare("SELECT category FROM equipment").all();
          const categories = Array.from(new Set((eqs || []).map((e: any) => e.category))).filter(Boolean).sort();

          if (categories.length === 0) {
            await sendTelegram('sendMessage', {
              chat_id: chatId,
              text: '❌ <b>ไม่พบข้อมูลหมวดหมู่อุปกรณ์คลังพัสดุในขณะนี้</b>\nกรุณาเพิ่มรายการอุปกรณ์พร้อมระบุหมวดหมู่ที่เหมาะสมในแผงจัดการคลังอุปกรณ์ก่อนนะคะ',
              parse_mode: 'HTML'
            });
            return new Response('OK', { status: 200 });
          }

          // Build Keyboard Layout
          const keyboard: any[] = [];
          for (let i = 0; i < categories.length; i += 2) {
            const row: any[] = [];
            row.push({
              text: `📦 ${categories[i]}`,
              callback_data: `cat_${i}`
            });
            if (i + 1 < categories.length) {
              row.push({
                text: `📦 ${categories[i + 1]}`,
                callback_data: `cat_${i + 1}`
              });
            }
            keyboard.push(row);
          }

          await sendTelegram('sendMessage', {
            chat_id: chatId,
            text: '🤖 <b>ระบบจัดการคลังพัสดุ Cyfence Inventory</b>\n\nสวัสดีค่ะ กรุณาเลือกหมวดหมู่อุปกรณ์ที่คุณต้องการเช็คสถานะสต็อกคงเหลือปัจจุบันด้านล่างนี้ได้เลยค่ะ:',
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        }
        return new Response('OK', { status: 200 });
      }

      // B. Callback tap queries
      if (update.callback_query) {
        const callbackQueryId = update.callback_query.id;
        const chatId = update.callback_query.message.chat.id;
        const callbackData = update.callback_query.data || '';

        if (callbackData.startsWith('cat_')) {
          const catIndex = parseInt(callbackData.replace('cat_', ''), 10);

          const { results: eqs } = await env.DB.prepare("SELECT category FROM equipment").all();
          const categories = Array.from(new Set((eqs || []).map((e: any) => e.category))).filter(Boolean).sort();
          const selectedCategory = categories[catIndex];

          if (!selectedCategory) {
            await sendTelegram('answerCallbackQuery', {
              callback_query_id: callbackQueryId,
              text: '❌ ไม่พบหมวดหมู่ที่ระบุ โปรดลองส่งคำขอใหม่อีกครั้งค่ะ',
              show_alert: true
            });
            return new Response('OK', { status: 200 });
          }

          await sendTelegram('answerCallbackQuery', {
            callback_query_id: callbackQueryId,
            text: `กำลังตรวจสอบคลังหมวดหมู่: ${selectedCategory}...`
          });

          // Query stock from SQLite
          const { results: equipments } = await env.DB.prepare("SELECT * FROM equipment WHERE category = ? ORDER BY name ASC").bind(selectedCategory).all();

          let responseText = `📦 <b>รายงานสต็อกอุปกรณ์ล่าสุด</b>\n`;
          responseText += `<b>หมวดหมู่:</b> <code>${selectedCategory}</code>\n`;
          responseText += `-----------------------------------------\n\n`;

          if (!equipments || equipments.length === 0) {
            responseText += `❌ <i>ไม่พบข้อมูลอุปกรณ์คงเหลือในหมวดหมู่นี้ในระบบคลังพัสดุขณะนี้</i>\n`;
          } else {
            equipments.forEach((eq: any) => {
              const avail = eq.available_qty ?? 0;
              const total = eq.total_qty ?? 0;
              const borrowed = total - avail;
              const statusEmoji = avail > 5 ? '🟢' : avail > 0 ? '🟡' : '🔴';

              responseText += `${statusEmoji} <b>${eq.name}</b> (<code>${eq.code}</code>)\n`;
              responseText += `   » 📥 ว่างพร้อมใช้: <b>${avail}</b> ชิ้น\n`;
              responseText += `   » 📤 ถูกยืมใช้งาน: <b>${borrowed}</b> ชิ้น (สต็อกทั้งหมด ${total})\n\n`;
            });
          }

          responseText += `-----------------------------------------\n`;
          responseText += `🕒 <i>ข้อมูลอัปเดต Real-time: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })} น.</i>`;

          const backKeyboard = [
            [{ text: '🔙 ย้อนกลับไปเลือกหมวดหมู่', callback_data: 'show_categories' }]
          ];

          await sendTelegram('sendMessage', {
            chat_id: chatId,
            text: responseText,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: backKeyboard }
          });
        } else if (callbackData === 'show_categories') {
          const { results: eqs } = await env.DB.prepare("SELECT category FROM equipment").all();
          const categories = Array.from(new Set((eqs || []).map((e: any) => e.category))).filter(Boolean).sort();

          const keyboard: any[] = [];
          for (let i = 0; i < categories.length; i += 2) {
            const row: any[] = [];
            row.push({
              text: `📦 ${categories[i]}`,
              callback_data: `cat_${i}`
            });
            if (i + 1 < categories.length) {
              row.push({
                text: `📦 ${categories[i + 1]}`,
                callback_data: `cat_${i + 1}`
              });
            }
            keyboard.push(row);
          }

          await sendTelegram('answerCallbackQuery', {
            callback_query_id: callbackQueryId
          });

          await sendTelegram('sendMessage', {
            chat_id: chatId,
            text: '🤖 <b>ระบบจัดการคลังพัสดุ Cyfence Inventory</b>\n\nกรุณาเลือกหมวดหมู่อุปกรณ์ที่คุณต้องการเช็คสถานะสต็อกคงเหลือปัจจุบันด้านล่างนี้ได้เลยค่ะ:',
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: keyboard }
          });
        }
        return new Response('OK', { status: 200 });
      }

      return new Response('Unknown Telegram payload.', { status: 200 });
    } catch (e: any) {
      console.error('Error handling Telegram webhook POST:', e);
      return new Response(`Error: ${e.message}`, { status: 500 });
    }
  }

  return new Response('Method Not Allowed', { status: 405 });
}
